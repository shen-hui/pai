// Copyright (c) Microsoft Corporation
// All rights reserved. 
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and 
// to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING 
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, 
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 

package com.microsoft.frameworklauncher.applicationmaster;

import com.microsoft.frameworklauncher.common.definition.TaskStateDefinition;
import com.microsoft.frameworklauncher.common.exceptions.NonTransientException;
import com.microsoft.frameworklauncher.common.exit.FrameworkExitInfo;
import com.microsoft.frameworklauncher.common.exit.FrameworkExitSpec;
import com.microsoft.frameworklauncher.common.log.DefaultLogger;
import com.microsoft.frameworklauncher.common.model.*;
import com.microsoft.frameworklauncher.common.service.AbstractService;
import com.microsoft.frameworklauncher.common.service.StopStatus;
import com.microsoft.frameworklauncher.common.utils.DnsUtils;
import com.microsoft.frameworklauncher.common.utils.HadoopUtils;
import com.microsoft.frameworklauncher.common.utils.PortUtils;
import com.microsoft.frameworklauncher.common.utils.YamlUtils;
import com.microsoft.frameworklauncher.common.web.WebCommon;
import com.microsoft.frameworklauncher.zookeeperstore.ZookeeperStore;
import org.apache.hadoop.yarn.api.records.Container;
import org.apache.hadoop.yarn.api.records.Priority;
import org.apache.hadoop.yarn.client.api.AMRMClient.ContainerRequest;
import org.apache.log4j.Level;
import org.apache.zookeeper.KeeperException;

import java.util.*;

// Manage the CURD to ZK Status
public class StatusManager extends AbstractService {  // THREAD SAFE
  private static final DefaultLogger LOGGER = new DefaultLogger(StatusManager.class);

  private final ApplicationMaster am;
  private final Configuration conf;
  private final ZookeeperStore zkStore;

  /**
   * REGION BaseStatus
   */
  // AM only need to maintain TaskRoleStatus and TaskStatuses, and it is the only maintainer.
  // TaskRoleName -> TaskRoleStatus
  private final Map<String, TaskRoleStatus> taskRoleStatuses = new HashMap<>();
  // TaskRoleName -> TaskStatuses
  private final Map<String, TaskStatuses> taskStatuseses = new HashMap<>();

  /**
   * REGION ExtensionStatus
   * ExtensionStatus should be always CONSISTENT with BaseStatus
   */
  // Used to invert index TaskStatus by ContainerId/TaskState instead of TaskStatusLocator, i.e. TaskRoleName + TaskIndex
  // TaskState -> TaskStatusLocators
  private final Map<TaskState, Set<TaskStatusLocator>> taskStateLocators = new HashMap<>();
  // Live Associated ContainerId -> TaskStatusLocator
  private final Map<String, TaskStatusLocator> liveAssociatedContainerIdLocators = new HashMap<>();
  // Live Associated HostNames
  private final Set<String> liveAssociatedHostNames = new HashSet<>();

  /**
   * REGION StateVariable
   */
  // Whether Mem Status is changed since Latest Persisted Status
  // TaskRoleName -> TaskRoleStatusChanged
  private final Map<String, Boolean> taskRoleStatusesChanged = new HashMap<>();
  // TaskRoleName -> TaskStatusesChanged
  private final Map<String, Boolean> taskStatusesesChanged = new HashMap<>();

  // Latest Persisted Status
  // TaskRoleName -> AggregatedTaskRoleStatus
  private Map<String, AggregatedTaskRoleStatus> persistedAggTaskRoleStatuses = new HashMap<>();

  // No need to persist ContainerRequest since it is only valid within one application attempt.
  // Used to generate an unique Priority for each ContainerRequest in current application attempt.
  // This helps to match ContainerRequest and allocated Container.
  // Besides, it can also avoid the issue YARN-314.
  private Priority nextContainerRequestPriority = Priority.newInstance(0);
  // Used to track current ContainerRequest for Tasks in CONTAINER_REQUESTED state
  // TaskStatusLocator -> ContainerRequest
  private final Map<TaskStatusLocator, ContainerRequest> taskContainerRequests = new HashMap<>();
  // Used to invert index TaskStatusLocator by ContainerRequest.Priority
  // Priority -> TaskStatusLocator
  private final Map<Priority, TaskStatusLocator> priorityLocators = new HashMap<>();

  // No need to persist AllocatedContainer since it is only valid within one application attempt.
  // Used to track current AllocatedContainer for Tasks in CONTAINER_ALLOCATED state
  // TaskStatusLocator -> AllocatedContainer
  private final Map<TaskStatusLocator, Container> taskAllocatedContainers = new HashMap<>();

  // Used to indicate whether onOutstandingTaskDisappeared or onOutstandingTaskAppeared has been triggered
  // in current application attempt, so no need to persist.
  private boolean outstandingTaskCallbackTriggered = false;
  // Used to track current OutstandingTaskAppeared round within one application attempt, so no need to persist.
  private int outstandingTaskAppearedRound = 0;

  /**
   * REGION AbstractService
   */
  public StatusManager(ApplicationMaster am, Configuration conf, ZookeeperStore zkStore) {
    super(StatusManager.class.getName());
    this.am = am;
    this.conf = conf;
    this.zkStore = zkStore;
  }

  @Override
  protected Boolean handleException(Exception e) {
    super.handleException(e);

    LOGGER.logError(e,
        "Exception occurred in %1$s. %1$s will be stopped.",
        serviceName);

    // Rethrow is not work in another Thread, so using CallBack
    am.onExceptionOccurred(e);
    return false;
  }

  @Override
  protected void initialize() throws Exception {
    super.initialize();

    for (TaskState taskState : TaskState.values()) {
      taskStateLocators.put(taskState, new HashSet<>());
    }
  }

  @Override
  protected void recover() throws Exception {
    super.recover();

    AggregatedFrameworkStatus aggFrameworkStatus;

    try {
      aggFrameworkStatus = zkStore.getAggregatedFrameworkStatus(conf.getFrameworkName());
      for (Map.Entry<String, AggregatedTaskRoleStatus> aggTaskRoleStatus :
          aggFrameworkStatus.getAggregatedTaskRoleStatuses().entrySet()) {

        String taskRoleName = aggTaskRoleStatus.getKey();
        TaskRoleStatus taskRoleStatus = aggTaskRoleStatus.getValue().getTaskRoleStatus();
        TaskStatuses taskStatuses = aggTaskRoleStatus.getValue().getTaskStatuses();

        // During Service upgradeFramework, there is a little chance that the previous AM cannot be killed by RM
        // immediately (such as AM container node lost), but Service considers the previous AM is killed then
        // upgrade the FrameworkStatus.
        // After that, the previous AM can still pushStatus for the outdated FrameworkVersion.
        // So, for the current AM, it should avoid to recover status with outdated FrameworkVersion.
        // Note, the status provided by Launcher is eventually consistent, since the previous AM will eventually
        // exit either due to AM RM heartbeat or pushStatus.existsLocalVersionFrameworkRequest.
        if (!taskRoleStatus.getFrameworkVersion().equals(conf.getFrameworkVersion())) {
          throw new NonTransientException(String.format(
              "[%s]: FrameworkVersion mismatch: Local Version %s, Previous TaskRoleStatus Version %s",
              taskRoleName, conf.getFrameworkVersion(), taskRoleStatus.getFrameworkVersion()));
        }

        if (!taskStatuses.getFrameworkVersion().equals(conf.getFrameworkVersion())) {
          throw new NonTransientException(String.format(
              "[%s]: FrameworkVersion mismatch: Local Version %s, Previous TaskStatuses Version %s",
              taskRoleName, conf.getFrameworkVersion(), taskStatuses.getFrameworkVersion()));
        }
      }
    } catch (KeeperException.NoNodeException e) {
      throw new NonTransientException(
          "Failed to getAggregatedFrameworkStatus, FrameworkStatus is already deleted on ZK", e);
    } catch (KeeperException e) {
      throw e;
    } catch (Exception e) {
      LOGGER.logError(e,
          "Failed to recover %s. Reinitializing all TaskRoleStatuses and TaskStatuseses in the Framework on ZK.",
          serviceName);
      zkStore.deleteFrameworkStatus(conf.getFrameworkName(), true);
      aggFrameworkStatus = null;
    }

    if (aggFrameworkStatus != null) {
      for (Map.Entry<String, AggregatedTaskRoleStatus> aggTaskRoleStatus :
          aggFrameworkStatus.getAggregatedTaskRoleStatuses().entrySet()) {

        String taskRoleName = aggTaskRoleStatus.getKey();
        TaskRoleStatus taskRoleStatus = aggTaskRoleStatus.getValue().getTaskRoleStatus();
        TaskStatuses taskStatuses = aggTaskRoleStatus.getValue().getTaskStatuses();

        taskRoleStatuses.put(taskRoleName, taskRoleStatus);
        taskStatuseses.put(taskRoleName, taskStatuses);

        taskRoleStatusesChanged.put(taskRoleName, false);
        taskStatusesesChanged.put(taskRoleName, false);

        List<TaskStatus> taskStatusArray = taskStatuses.getTaskStatusArray();
        for (int taskIndex = 0; taskIndex < taskStatusArray.size(); taskIndex++) {
          addExtensionTaskStatus(new TaskStatusLocator(taskRoleName, taskIndex));
        }
      }

      // Recover Latest Persisted Status
      updatePersistedAggTaskRoleStatuses();

      LOGGER.logInfo("Succeeded to recover %s.", serviceName);
    }

    // Here ZK and Mem Status is the same.
    // Since Request may be ahead of Status even when Running,
    // so here the Recovery of AM StatusManager has completed.
  }

  @Override
  protected void run() throws Exception {
    super.run();

    new Thread(() -> {
      while (true) {
        try {
          pushStatus();

          Thread.sleep(conf.getLauncherConfig().getAmStatusPushIntervalSec() * 1000);
        } catch (Exception e) {
          // Directly throw TransientException to AM to actively migrate to another node
          handleException(e);
        }
      }
    }).start();
  }

  @Override
  public void stop(StopStatus stopStatus) {
    // Best Effort to stop Gracefully
    try {
      super.stop(stopStatus);

      LOGGER.logInfo("pushStatus for the last time before stop %s.", serviceName);
      pushStatus();

      // No need to stop ongoing Thread, since zkStore is Atomic
    } catch (Exception pe) {
      LOGGER.logWarning(pe, "Failed to stop %s gracefully, rollback to latest persisted status.", serviceName);

      // Best Effort to rollback to latest persisted status
      try {
        rollbackStatus();
      } catch (Exception re) {
        LOGGER.logWarning(re, "Failed to rollback to latest persisted status before stop %s.", serviceName);
      }
    }
  }


  /**
   * REGION InternalUtils
   */
  private void assertTaskStatusLocator(TaskStatusLocator locator) {
    assert containsTask(locator);
  }

  private void assertLiveAssociatedContainerId(String containerId) {
    assert isContainerIdLiveAssociated(containerId);
  }

  private void assertPriority(Priority priority) {
    assert containsTask(priority);
  }

  private synchronized void pushStatus() throws Exception {
    // TODO: Store AttemptId in AMStatus, and double check it before pushStatus

    // Best Effort to avoid pushStatus, if the FrameworkRequest for local FrameworkVersion does not exist
    Boolean existsLocalVersionFrameworkRequest = am.existsLocalVersionFrameworkRequest();
    if (existsLocalVersionFrameworkRequest == null) {
      LOGGER.logInfo("FrameworkRequest for local FrameworkVersion is not available, skip to pushStatus");
      return;
    } else if (!existsLocalVersionFrameworkRequest) {
      LOGGER.logInfo("FrameworkRequest for local FrameworkVersion does not exist, skip to pushStatus");
      return;
    }

    // Push TaskRoleStatuses
    for (TaskRoleStatus taskRoleStatus : taskRoleStatuses.values()) {
      String taskRoleName = taskRoleStatus.getTaskRoleName();
      if (taskRoleStatusesChanged.get(taskRoleName)) {
        LOGGER.logInfo("[%s]: Pushing TaskRoleStatus", taskRoleName);

        zkStore.setTaskRoleStatus(conf.getFrameworkName(), taskRoleName, taskRoleStatus);
        taskRoleStatusesChanged.put(taskRoleName, false);

        LOGGER.logInfo("[%s]: Pushed TaskRoleStatus", taskRoleName);
      }
    }

    // Push TaskStatuseses
    for (TaskStatuses taskStatuses : taskStatuseses.values()) {
      String taskRoleName = taskStatuses.getTaskRoleName();
      if (taskStatusesesChanged.get(taskRoleName)) {
        LOGGER.logInfo("[%s]: Pushing TaskStatuses", taskRoleName);

        zkStore.setTaskStatuses(conf.getFrameworkName(), taskRoleName, taskStatuses);
        taskStatusesesChanged.put(taskRoleName, false);
        logTaskStateCounters(taskRoleName);

        LOGGER.logInfo("[%s]: Pushed TaskStatuses", taskRoleName);
      }
    }

    // Update Latest Persisted Status
    updatePersistedAggTaskRoleStatuses();
  }

  // Rollback to latest persisted status in case failed to stop gracefully
  private synchronized void rollbackStatus() {
    // Rollback TaskStatuseses
    for (TaskStatuses taskStatuses : taskStatuseses.values()) {
      String taskRoleName = taskStatuses.getTaskRoleName();
      if (taskStatusesesChanged.get(taskRoleName)) {
        LOGGER.logInfo("[%s]: Rolling back TaskStatuses", taskRoleName);

        List<TaskStatus> taskStatusArray = taskStatuses.getTaskStatusArray();
        for (TaskStatus taskStatus : taskStatusArray) {
          Integer taskIndex = taskStatus.getTaskIndex();
          TaskState taskState = taskStatus.getTaskState();

          // Release Container for not yet persisted CONTAINER_LIVE_ASSOCIATED_STATES Task.
          // This can help to avoid CONTAINER_RM_RESYNC_EXCEEDED.
          if (TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES.contains(taskState)) {
            if (!persistedAggTaskRoleStatuses.containsKey(taskRoleName)) {
              am.onTaskToReleaseContainer(taskStatus);
            } else {
              List<TaskStatus> persistedTaskStatusArray =
                  persistedAggTaskRoleStatuses.get(taskRoleName).getTaskStatuses().getTaskStatusArray();
              if (persistedTaskStatusArray.size() <= taskIndex) {
                am.onTaskToReleaseContainer(taskStatus);
              } else {
                TaskStatus persistedTaskStatus = persistedTaskStatusArray.get(taskIndex);
                TaskState persistedTaskState = persistedTaskStatus.getTaskState();
                if (!TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES.contains(persistedTaskState)) {
                  am.onTaskToReleaseContainer(taskStatus);
                }
              }
            }
          }
        }

        LOGGER.logInfo("[%s]: Rolled back TaskStatuses", taskRoleName);
      }
    }
  }

  // Should call disassociateTaskWithContainer if associateTaskWithContainer failed
  private void associateTaskWithContainer(
      TaskStatusLocator locator, Container container, Map<String, Ports> portDefinitions) throws Exception {
    TaskStatus taskStatus = getTaskStatus(locator);
    String containerId = container.getId().toString();

    taskStatus.setContainerId(containerId);
    taskStatus.setContainerHost(container.getNodeId().getHost());
    taskStatus.setContainerIp(DnsUtils.resolveIp(taskStatus.getContainerHost()));
    taskStatus.setContainerLogHttpAddress(
        HadoopUtils.getContainerLogHttpAddress(container.getNodeHttpAddress(), containerId, conf.getAmUser()));
    taskStatus.setContainerConnectionLostCount(0);
    taskStatus.setContainerGpus(
        ResourceDescriptor.fromResource(container.getResource()).getGpuAttribute());
    taskStatus.setContainerPorts(PortUtils.toPortString(
        ResourceDescriptor.fromResource(container.getResource()).getPortRanges(),
        portDefinitions));

    taskStatusesesChanged.put(locator.getTaskRoleName(), true);
  }

  private void disassociateTaskWithContainer(TaskStatusLocator locator) {
    TaskStatus taskStatus = getTaskStatus(locator);

    taskStatus.setContainerId(null);
    taskStatus.setContainerHost(null);
    taskStatus.setContainerIp(null);
    taskStatus.setContainerLogHttpAddress(null);
    taskStatus.setContainerConnectionLostCount(null);
    taskStatus.setContainerIsDecommissioning(null);
    taskStatus.setContainerLaunchedTimestamp(null);
    taskStatus.setContainerCompletedTimestamp(null);
    taskStatus.setContainerExitCode(null);
    taskStatus.setContainerExitDescription(null);
    taskStatus.setContainerExitDiagnostics(null);
    taskStatus.setContainerExitType(null);
    taskStatus.setContainerGpus(null);
    taskStatus.setContainerPorts(null);

    taskStatusesesChanged.put(locator.getTaskRoleName(), true);
  }

  private void updateExtensionTaskStatusWithContainerLiveness(TaskStatusLocator locator, Boolean isLive) {
    TaskStatus taskStatus = getTaskStatus(locator);
    String containerId = taskStatus.getContainerId();
    String containerHostName = taskStatus.getContainerHost();

    if (isLive) {
      liveAssociatedContainerIdLocators.put(containerId, locator);
      liveAssociatedHostNames.add(taskStatus.getContainerHost());
    } else {
      liveAssociatedContainerIdLocators.remove(containerId);
      liveAssociatedHostNames.remove(containerHostName);
    }
  }

  private void decreaseTaskNumber(String taskRoleName, int newTaskNumber) {
    List<TaskStatus> taskStatusArray = taskStatuseses.get(taskRoleName).getTaskStatusArray();

    LOGGER.logInfo(
        "[%s]: Decrease TaskNumber from [%s] to [%s]",
        taskRoleName, taskStatusArray.size(), newTaskNumber);

    LOGGER.logInfo(
        "[%s]: Remove Tasks in TaskIndex range [%s, %s). " +
            "Will release the corresponding Container later.",
        taskRoleName, newTaskNumber, taskStatusArray.size());

    // Pop TaskStatuses Stack
    for (int taskIndex = taskStatusArray.size() - 1; taskIndex >= newTaskNumber; taskIndex--) {
      TaskStatusLocator locator = new TaskStatusLocator(taskRoleName, taskIndex);
      TaskStatus taskStatus = getTaskStatus(locator);

      // Notify AM to Cleanup Task level external resource [RM] immediately
      // instead of waiting until next round RMResync
      am.onTaskToRemove(taskStatus);

      // Update ExtensionStatus
      removeExtensionTaskStatus(locator);

      // Update StateVariable
      removeContainerRequest(locator);
      removeAllocatedContainer(locator);

      // To ensure other Task's TaskIndex unchanged, we have to remove the Task at tail
      taskStatusArray.remove(taskIndex);
    }

    taskStatusesesChanged.put(taskRoleName, true);
  }

  private void removeExtensionTaskStatus(TaskStatusLocator locator) {
    TaskStatus taskStatus = getTaskStatus(locator);
    TaskState taskState = taskStatus.getTaskState();

    taskStateLocators.get(taskState).remove(locator);
    if (TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES.contains(taskState)) {
      updateExtensionTaskStatusWithContainerLiveness(locator, false);
    }
  }

  private void removeContainerRequest(TaskStatusLocator locator) {
    if (taskContainerRequests.containsKey(locator)) {
      priorityLocators.remove(taskContainerRequests.get(locator).getPriority());
      taskContainerRequests.remove(locator);
    }
  }

  private void removeAllocatedContainer(TaskStatusLocator locator) {
    if (taskAllocatedContainers.containsKey(locator)) {
      taskAllocatedContainers.remove(locator);
    }
  }

  private void increaseTaskNumber(String taskRoleName, int newTaskNumber) {
    List<TaskStatus> taskStatusArray = taskStatuseses.get(taskRoleName).getTaskStatusArray();

    LOGGER.logInfo(
        "[%s]: Increase TaskNumber from [%s] to [%s]",
        taskRoleName, taskStatusArray.size(), newTaskNumber);

    LOGGER.logInfo(
        "[%s]: Add Tasks in TaskIndex range [%s, %s). " +
            "Will request the corresponding Container later.",
        taskRoleName, taskStatusArray.size(), newTaskNumber);

    // Push TaskStatuses Stack
    for (int taskIndex = taskStatusArray.size(); taskIndex < newTaskNumber; taskIndex++) {
      TaskStatus taskStatus = new TaskStatus();
      taskStatus.setTaskIndex(taskIndex);
      taskStatus.setTaskRoleName(taskRoleName);
      taskStatus.setTaskState(TaskState.TASK_WAITING);
      taskStatus.setTaskRetryPolicyState(new RetryPolicyState());
      taskStatus.setTaskCreatedTimestamp(System.currentTimeMillis());
      taskStatus.setTaskServiceStatus(new ServiceStatus());
      taskStatus.getTaskServiceStatus().setServiceVersion(am.getServiceVersion(taskRoleName));

      // To ensure other Task's TaskIndex unchanged, we have to add the Task at tail
      // The corresponding Containers will be requested by following AddContainerRequest
      taskStatusArray.add(taskStatus);

      // Update ExtensionStatus
      addExtensionTaskStatus(new TaskStatusLocator(taskRoleName, taskIndex));
    }

    taskStatusesesChanged.put(taskRoleName, true);
  }

  private void addExtensionTaskStatus(TaskStatusLocator locator) {
    TaskStatus taskStatus = getTaskStatus(locator);
    TaskState taskState = taskStatus.getTaskState();

    taskStateLocators.get(taskState).add(locator);
    if (TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES.contains(taskState)) {
      updateExtensionTaskStatusWithContainerLiveness(locator, true);
    }
  }

  private void addContainerRequest(TaskStatusLocator locator, ContainerRequest request) {
    nextContainerRequestPriority = Priority.newInstance(nextContainerRequestPriority.getPriority() + 1);
    taskContainerRequests.put(locator, request);
    priorityLocators.put(request.getPriority(), locator);
  }

  private void addAllocatedContainer(TaskStatusLocator locator, Container container) {
    taskAllocatedContainers.put(locator, container);
  }

  private void setContainerConnectionLostCount(String containerId, int count) {
    TaskStatus taskStatus = getTaskStatusWithLiveAssociatedContainerId(containerId);
    if (taskStatus.getContainerConnectionLostCount() != count) {
      taskStatus.setContainerConnectionLostCount(count);
      taskStatusesesChanged.put(taskStatus.getTaskRoleName(), true);
    }
  }

  private void logTaskStateCounters(String taskRoleName) {
    Map<String, Integer> taskStateCounters = getTaskStateCounters(taskRoleName);
    for (Map.Entry<String, Integer> taskStateCounter : taskStateCounters.entrySet()) {
      String taskStateStr = taskStateCounter.getKey();
      Integer taskCount = taskStateCounter.getValue();
      LOGGER.logInfo(
          "TaskStateCounters: [%s][%s]: Count %s",
          taskRoleName, taskStateStr, taskCount);
    }
  }

  private synchronized Map<String, Integer> getTaskStateCounters(String taskRoleName) {
    List<TaskStatus> taskStatusArray = taskStatuseses.get(taskRoleName).getTaskStatusArray();
    Map<String, Integer> taskStateCounters = new HashMap<>();

    for (TaskStatus taskStatus : taskStatusArray) {
      TaskState taskState = taskStatus.getTaskState();
      String taskStateStr = taskState.toString();
      Integer containerExitCode = taskStatus.getContainerExitCode();

      if (taskState == TaskState.TASK_COMPLETED) {
        // Override TASK_COMPLETED to provide more detailed TaskState
        if (containerExitCode == 0) {
          taskStateStr = "TaskSucceeded";
        } else {
          taskStateStr = "TaskFailed";
        }
      }

      if (!taskStateCounters.containsKey(taskStateStr)) {
        taskStateCounters.put(taskStateStr, 0);
      }
      taskStateCounters.put(taskStateStr, taskStateCounters.get(taskStateStr) + 1);
    }

    return taskStateCounters;
  }

  private void updatePersistedAggTaskRoleStatuses() {
    Map<String, AggregatedTaskRoleStatus> aggTaskRoleStatuses = new HashMap<>();
    for (TaskRoleStatus taskRoleStatus : taskRoleStatuses.values()) {
      String taskRoleName = taskRoleStatus.getTaskRoleName();
      TaskStatuses taskStatuses = taskStatuseses.get(taskRoleName);

      AggregatedTaskRoleStatus aggTaskRoleStatus = new AggregatedTaskRoleStatus();
      aggTaskRoleStatus.setTaskRoleStatus(YamlUtils.deepCopy(taskRoleStatus, TaskRoleStatus.class));
      aggTaskRoleStatus.setTaskStatuses(YamlUtils.deepCopy(taskStatuses, TaskStatuses.class));
      aggTaskRoleStatuses.put(taskRoleName, aggTaskRoleStatus);
    }

    persistedAggTaskRoleStatuses = aggTaskRoleStatuses;
  }

  private void onOutstandingTaskDisappeared() {
    outstandingTaskCallbackTriggered = true;
    outstandingTaskAppearedRound++;
    am.onOutstandingTaskDisappeared();
  }

  private void onOutstandingTaskAppeared(int outstandingTaskCount) {
    outstandingTaskCallbackTriggered = true;
    am.onOutstandingTaskAppeared(outstandingTaskAppearedRound, outstandingTaskCount);
  }

  /**
   * REGION ReadInterface
   */
  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized TaskStatus getTaskStatus(TaskStatusLocator locator) {
    assertTaskStatusLocator(locator);
    return taskStatuseses.get(locator.getTaskRoleName()).getTaskStatusArray().get(locator.getTaskIndex());
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized List<TaskStatus> getTaskStatus(Set<TaskState> taskStateSet) {
    return getTaskStatus(taskStateSet, null);
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized List<TaskStatus> getTaskStatus(Set<TaskState> taskStateSet, String taskRoleName) {
    return getTaskStatus(taskStateSet, taskRoleName, true);
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized List<TaskStatus> getTaskStatus(Set<TaskState> taskStateSet, String taskRoleName, Boolean contains) {
    Set<TaskState> acceptableTaskStateSet = new HashSet<>();
    if (contains) {
      acceptableTaskStateSet.addAll(taskStateSet);
    } else {
      for (TaskState taskState : TaskState.values()) {
        if (!taskStateSet.contains(taskState)) {
          acceptableTaskStateSet.add(taskState);
        }
      }
    }

    List<TaskStatus> taskStatuses = new ArrayList<>();
    for (TaskState taskState : acceptableTaskStateSet) {
      for (TaskStatusLocator locator : taskStateLocators.get(taskState)) {
        if (taskRoleName == null || taskRoleName.equals(locator.getTaskRoleName())) {
          taskStatuses.add(getTaskStatus(locator));
        }
      }
    }
    return taskStatuses;
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized List<TaskStatus> getFailedTaskStatus() {
    return getFailedTaskStatus(null);
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized List<TaskStatus> getFailedTaskStatus(String taskRoleName) {
    List<TaskStatus> failedTaskStatuses = new ArrayList<>();
    for (TaskStatus taskStatus : getTaskStatus(TaskStateDefinition.FINAL_STATES, taskRoleName)) {
      if (taskStatus.getContainerExitType() != ExitType.SUCCEEDED) {
        failedTaskStatuses.add(taskStatus);
      }
    }
    return failedTaskStatuses;
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized List<TaskStatus> getSucceededTaskStatus() {
    return getSucceededTaskStatus(null);
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized List<TaskStatus> getSucceededTaskStatus(String taskRoleName) {
    List<TaskStatus> succeededTaskStatuses = new ArrayList<>();
    for (TaskStatus taskStatus : getTaskStatus(TaskStateDefinition.FINAL_STATES, taskRoleName)) {
      if (taskStatus.getContainerExitType() == ExitType.SUCCEEDED) {
        succeededTaskStatuses.add(taskStatus);
      }
    }
    return succeededTaskStatuses;
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized TaskStatus getTaskStatus(Priority priority) {
    assertPriority(priority);
    return getTaskStatus(priorityLocators.get(priority));
  }

  // Returned TaskStatus is readonly, caller should not modify it
  public synchronized TaskStatus getTaskStatusWithLiveAssociatedContainerId(String containerId) {
    assertLiveAssociatedContainerId(containerId);
    return getTaskStatus(liveAssociatedContainerIdLocators.get(containerId));
  }

  public synchronized List<String> getLiveAssociatedContainerIds() {
    return new ArrayList<>(liveAssociatedContainerIdLocators.keySet());
  }

  public synchronized Boolean isContainerIdLiveAssociated(String containerId) {
    return liveAssociatedContainerIdLocators.containsKey(containerId);
  }

  public synchronized List<String> getLiveAssociatedHostNames() {
    return new ArrayList<>(liveAssociatedHostNames);
  }

  public synchronized Boolean isHostNameLiveAssociated(String hostName) {
    return liveAssociatedHostNames.contains(hostName);
  }

  public synchronized Boolean containsTask(TaskStatusLocator locator) {
    return (taskStatuseses.containsKey(locator.getTaskRoleName()) &&
        taskStatuseses.get(locator.getTaskRoleName()).getTaskStatusArray().size() > locator.getTaskIndex() &&
        locator.getTaskIndex() >= 0);
  }

  public synchronized Boolean containsTask(Priority priority) {
    return priorityLocators.containsKey(priority);
  }

  public synchronized Boolean containsTask(TaskStatus taskStatus) {
    String taskRoleName = taskStatus.getTaskRoleName();
    TaskStatusLocator taskLocator = new TaskStatusLocator(taskRoleName, taskStatus.getTaskIndex());

    if (!containsTask(taskLocator)) {
      LOGGER.logDebug("TaskStatusLocator not found in Status. TaskStatusLocator: %s", taskLocator);
      return false;
    }

    TaskStatus thisTaskStatus = getTaskStatus(taskLocator);
    if (!YamlUtils.deepEquals(thisTaskStatus, taskStatus)) {
      LOGGER.logSplittedLines(Level.DEBUG,
          "TaskStatus not found in Status. TaskStatus:\n%s\nCurrent TaskStatus in Status:\n%s",
          WebCommon.toJson(taskStatus), WebCommon.toJson(thisTaskStatus));
      return false;
    }

    return true;
  }

  public synchronized int getTaskCount(String taskRoleName) {
    return taskStatuseses.get(taskRoleName).getTaskStatusArray().size();
  }

  public synchronized int getTaskCount() {
    int taskCount = 0;
    for (String taskRoleName : taskStatuseses.keySet()) {
      taskCount += getTaskCount(taskRoleName);
    }
    return taskCount;
  }

  public synchronized int getTaskCount(Set<TaskState> taskStateSet) {
    return getTaskStatus(taskStateSet).size();
  }

  public synchronized int getStartStateTaskCount() {
    return getTaskCount(TaskStateDefinition.START_STATES);
  }

  public synchronized int getFinalStateTaskCount() {
    return getTaskCount(TaskStateDefinition.FINAL_STATES);
  }

  public synchronized int getOutstandingStateTaskCount() {
    return getTaskCount(TaskStateDefinition.OUTSTANDING_STATES);
  }

  public synchronized Boolean isAllTaskInFinalState() {
    return (getFinalStateTaskCount() == getTaskCount());
  }

  public synchronized Float getApplicationProgress() {
    int totalTaskCount = getTaskCount();
    return totalTaskCount == 0 ? null :
        (float) getFinalStateTaskCount() / totalTaskCount;
  }

  public synchronized ContainerRequest getContainerRequest(TaskStatusLocator locator) {
    assertTaskStatusLocator(locator);
    return taskContainerRequests.get(locator);
  }

  public synchronized Priority getNextContainerRequestPriority() {
    return nextContainerRequestPriority;
  }

  public synchronized Container getAllocatedContainer(TaskStatusLocator locator) {
    assertTaskStatusLocator(locator);
    return taskAllocatedContainers.get(locator);
  }

  public synchronized Map<String, AggregatedTaskRoleStatus> getPersistedAggTaskRoleStatuses() {
    return persistedAggTaskRoleStatuses;
  }

  public synchronized List<ValueRange> getAnyLiveAssociatedContainerPorts(String taskRoleName) {
    List<TaskStatus> taskStatuses = getTaskStatus(
        TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES, taskRoleName);
    if (taskStatuses.size() > 0) {
      return PortUtils.toPortRanges(taskStatuses.get(0).getContainerPorts());
    } else {
      return new ArrayList<>();
    }
  }

  public synchronized int getOutstandingTaskAppearedRound() {
    return outstandingTaskAppearedRound;
  }

  /**
   * REGION ModifyInterface
   * Note to avoid update partially modified Status on ZK
   */
  // transitionTaskState is the only interface to modify TaskState for both internal and external
  public synchronized void transitionTaskState(
      TaskStatusLocator locator,
      TaskState dstState) throws Exception {
    transitionTaskState(locator, dstState, new TaskEvent());
  }

  public synchronized void transitionTaskState(
      TaskStatusLocator locator,
      TaskState dstState,
      TaskEvent event) throws Exception {

    TaskStatus taskStatus = getTaskStatus(locator);
    TaskState srcState = taskStatus.getTaskState();

    // State transition function between each TaskState
    // Attempt to transition
    if (srcState == dstState) {
      return;
    }
    assert (!TaskStateDefinition.FINAL_STATES.contains(srcState));

    if (srcState == TaskState.CONTAINER_REQUESTED) {
      removeContainerRequest(locator);
    }

    if (dstState == TaskState.CONTAINER_REQUESTED) {
      assert (event.getContainerRequest() != null);
      addContainerRequest(locator, event.getContainerRequest());
    }

    if (!TaskStateDefinition.CONTAINER_ASSOCIATED_STATES.contains(srcState) &&
        TaskStateDefinition.CONTAINER_ASSOCIATED_STATES.contains(dstState)) {
      assert (event.getContainer() != null);

      String containerId = event.getContainer().getId().toString();
      try {
        associateTaskWithContainer(locator, event.getContainer(), event.getPortDefinitions());
        LOGGER.logInfo("Associated Task %s with Container %s", locator, containerId);
      } catch (Exception e) {
        disassociateTaskWithContainer(locator);
        throw new Exception(
            String.format("Failed to associate Container %s to Task %s",
                containerId, locator), e);
      }
    }

    if (!TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES.contains(srcState) &&
        TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES.contains(dstState)) {
      updateExtensionTaskStatusWithContainerLiveness(locator, true);
    }

    if (TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES.contains(srcState) &&
        !TaskStateDefinition.CONTAINER_LIVE_ASSOCIATED_STATES.contains(dstState)) {
      updateExtensionTaskStatusWithContainerLiveness(locator, false);
    }

    if (TaskStateDefinition.CONTAINER_ASSOCIATED_STATES.contains(srcState) &&
        !TaskStateDefinition.CONTAINER_ASSOCIATED_STATES.contains(dstState)) {
      disassociateTaskWithContainer(locator);
    }

    if (srcState == TaskState.CONTAINER_ALLOCATED) {
      removeAllocatedContainer(locator);
    }

    if (dstState == TaskState.CONTAINER_ALLOCATED) {
      assert (event.getContainer() != null);
      addAllocatedContainer(locator, event.getContainer());
    }

    if (dstState == TaskState.CONTAINER_COMPLETED) {
      assert (event.getContainerRawExitCode() != null);

      Integer exitCode = FrameworkExitSpec.lookupExitCode(
          event.getContainerRawExitCode(), event.getContainerRawExitDiagnostics());
      FrameworkExitInfo exitInfo = FrameworkExitSpec.getExitInfo(exitCode);

      taskStatus.setContainerExitCode(exitCode);
      taskStatus.setContainerExitDescription(exitInfo.getDescription());
      taskStatus.setContainerExitDiagnostics(event.getContainerRawExitDiagnostics());
      taskStatus.setContainerExitType(exitInfo.getType());
    }

    // Task will be Retried
    if (srcState == TaskState.CONTAINER_COMPLETED && dstState == TaskState.TASK_WAITING) {
      // Ensure transitionTaskState and RetryPolicyState is Transactional
      assert (event.getNewRetryPolicyState() != null);
      taskStatus.setTaskRetryPolicyState(event.getNewRetryPolicyState());
    }

    // Record Timestamps
    Long currentTimestamp = System.currentTimeMillis();
    if (dstState == TaskState.TASK_COMPLETED) {
      taskStatus.setTaskCompletedTimestamp(currentTimestamp);
    } else if (dstState == TaskState.CONTAINER_LAUNCHED) {
      taskStatus.setContainerLaunchedTimestamp(currentTimestamp);
    } else if (dstState == TaskState.CONTAINER_COMPLETED) {
      taskStatus.setContainerCompletedTimestamp(currentTimestamp);
    }

    // Start Transition
    taskStateLocators.get(srcState).remove(locator);
    taskStateLocators.get(dstState).add(locator);
    taskStatus.setTaskState(dstState);

    // Mark as changed
    taskStatusesesChanged.put(locator.getTaskRoleName(), true);
    LOGGER.logInfo("Transitioned Task %s from [%s] to [%s]", locator, srcState, dstState);

    // Start Transition Callbacks
    if (TaskStateDefinition.OUTSTANDING_STATES.contains(srcState) &&
        !TaskStateDefinition.OUTSTANDING_STATES.contains(dstState)) {
      int outstandingTaskCount = getOutstandingStateTaskCount();
      if (outstandingTaskCount == 0) {
        onOutstandingTaskDisappeared();
      }
    }

    if (!TaskStateDefinition.OUTSTANDING_STATES.contains(srcState) &&
        TaskStateDefinition.OUTSTANDING_STATES.contains(dstState)) {
      int outstandingTaskCount = getOutstandingStateTaskCount();
      if (outstandingTaskCount == 1) {
        onOutstandingTaskAppeared(outstandingTaskCount);
      }
    }
  }

  public synchronized void updateTaskNumbers(Map<String, Integer> newTaskNumbers) {
    int previousOutstandingTaskCount = getOutstandingStateTaskCount();

    for (Map.Entry<String, Integer> newTaskNumberKV : newTaskNumbers.entrySet()) {
      String newTaskRoleName = newTaskNumberKV.getKey();
      int newTaskNumber = newTaskNumberKV.getValue();

      // Setup TaskRole
      if (!taskRoleStatuses.containsKey(newTaskRoleName)) {
        TaskRoleStatus taskRoleStatus = new TaskRoleStatus();
        taskRoleStatus.setTaskRoleName(newTaskRoleName);
        taskRoleStatus.setTaskRoleRolloutStatus(new TaskRoleRolloutStatus());
        taskRoleStatus.setFrameworkVersion(conf.getFrameworkVersion());
        taskRoleStatuses.put(newTaskRoleName, taskRoleStatus);
        taskRoleStatusesChanged.put(newTaskRoleName, true);
      }

      if (!taskStatuseses.containsKey(newTaskRoleName)) {
        TaskStatuses taskStatuses = new TaskStatuses();
        taskStatuses.setTaskRoleName(newTaskRoleName);
        taskStatuses.setTaskStatusArray(new ArrayList<>());
        taskStatuses.setFrameworkVersion(conf.getFrameworkVersion());
        taskStatuseses.put(newTaskRoleName, taskStatuses);
        taskStatusesesChanged.put(newTaskRoleName, true);
      }

      // Update TaskStatus
      Integer curTaskNumber = taskStatuseses.get(newTaskRoleName).getTaskStatusArray().size();
      if (newTaskNumber < curTaskNumber) {
        decreaseTaskNumber(newTaskRoleName, newTaskNumber);
      } else if (newTaskNumber > curTaskNumber) {
        increaseTaskNumber(newTaskRoleName, newTaskNumber);
      }
    }

    // Start UpdateTaskNumbers Callbacks
    int currentOutstandingTaskCount = getOutstandingStateTaskCount();
    if (!outstandingTaskCallbackTriggered) {
      // If onOutstandingTaskDisappeared or onOutstandingTaskAppeared has not been triggered yet,
      // they should be recovered, regardless of previousOutstandingTaskCount.
      if (currentOutstandingTaskCount == 0) {
        onOutstandingTaskDisappeared();
      } else if (currentOutstandingTaskCount > 0) {
        onOutstandingTaskAppeared(currentOutstandingTaskCount);
      }
    } else {
      if (previousOutstandingTaskCount > 0 && currentOutstandingTaskCount == 0) {
        onOutstandingTaskDisappeared();
      } else if (previousOutstandingTaskCount == 0 && currentOutstandingTaskCount > 0) {
        onOutstandingTaskAppeared(currentOutstandingTaskCount);
      }
    }
  }

  public synchronized void resetContainerConnectionLostCount(String containerId) {
    setContainerConnectionLostCount(containerId, 0);
  }

  public synchronized void resetContainerConnectionLostCount() {
    for (String containerId : getLiveAssociatedContainerIds()) {
      resetContainerConnectionLostCount(containerId);
    }
  }

  public synchronized void increaseContainerConnectionLostCount(String containerId) {
    TaskStatus taskStatus = getTaskStatusWithLiveAssociatedContainerId(containerId);
    setContainerConnectionLostCount(containerId, taskStatus.getContainerConnectionLostCount() + 1);
  }
}
