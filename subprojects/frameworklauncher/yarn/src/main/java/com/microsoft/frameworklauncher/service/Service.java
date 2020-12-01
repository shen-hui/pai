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

package com.microsoft.frameworklauncher.service;

import com.microsoft.frameworklauncher.common.GlobalConstants;
import com.microsoft.frameworklauncher.common.definition.FrameworkStateDefinition;
import com.microsoft.frameworklauncher.common.exceptions.AggregateException;
import com.microsoft.frameworklauncher.common.exceptions.NonTransientException;
import com.microsoft.frameworklauncher.common.exit.AMDiagnostics;
import com.microsoft.frameworklauncher.common.exit.FrameworkExitCode;
import com.microsoft.frameworklauncher.common.exit.FrameworkExitSpec;
import com.microsoft.frameworklauncher.common.exts.CommonExts;
import com.microsoft.frameworklauncher.common.exts.HadoopExts;
import com.microsoft.frameworklauncher.common.log.ChangeAwareLogger;
import com.microsoft.frameworklauncher.common.log.DefaultLogger;
import com.microsoft.frameworklauncher.common.model.*;
import com.microsoft.frameworklauncher.common.service.AbstractService;
import com.microsoft.frameworklauncher.common.service.StopStatus;
import com.microsoft.frameworklauncher.common.service.SystemTaskQueue;
import com.microsoft.frameworklauncher.common.utils.CommonUtils;
import com.microsoft.frameworklauncher.common.utils.HadoopUtils;
import com.microsoft.frameworklauncher.common.utils.RetryUtils;
import com.microsoft.frameworklauncher.common.utils.YamlUtils;
import com.microsoft.frameworklauncher.common.validation.CommonValidation;
import com.microsoft.frameworklauncher.common.web.WebCommon;
import com.microsoft.frameworklauncher.hdfsstore.HdfsStore;
import com.microsoft.frameworklauncher.webserver.WebServer;
import com.microsoft.frameworklauncher.zookeeperstore.ZookeeperStore;
import org.apache.hadoop.fs.FileSystem;
import org.apache.hadoop.io.DataOutputBuffer;
import org.apache.hadoop.security.Credentials;
import org.apache.hadoop.security.UserGroupInformation;
import org.apache.hadoop.yarn.api.ApplicationConstants;
import org.apache.hadoop.yarn.api.records.*;
import org.apache.hadoop.yarn.client.api.YarnClient;
import org.apache.hadoop.yarn.conf.YarnConfiguration;
import org.apache.hadoop.yarn.exceptions.YarnException;
import org.apache.log4j.Level;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Maintains the life cycle for all Frameworks submitted to this Launcher.Service.
// It is the engine to transition Status to satisfy Request eventually.
// It is designed as a micro kernel to connect all its SubServices.
// Note:
//  It ensures at most one AM running for one Framework.
public class Service extends AbstractService {
  private static final DefaultLogger LOGGER = new DefaultLogger(Service.class);
  private static final ChangeAwareLogger CHANGE_AWARE_LOGGER = new ChangeAwareLogger(Service.class);

  private YarnConfiguration yarnConf = new YarnConfiguration();
  private LauncherConfiguration conf;
  private UserContainerExitSpec userContainerExitSpec;
  private SystemTaskQueue transitionFrameworkStateQueue;


  /**
   * REGION SubServices
   */
  private ZookeeperStore zkStore;
  private HdfsStore hdfsStore;
  private YarnClient yarnClient;
  private StatusManager statusManager;
  private RequestManager requestManager;
  private RMResyncHandler rmResyncHandler;
  private AMDiagnosticsRetriever amDiagnosticsRetriever;


  /**
   * REGION ExternalServices
   */
  private WebServer webServer;


  /**
   * REGION AbstractService
   */
  public Service() {
    super(Service.class.getName(), true);
  }

  @Override
  protected Boolean handleException(Exception e) {
    super.handleException(e);

    if (e instanceof NonTransientException) {
      LOGGER.logError(e,
          "NonTransientException occurred in %1$s. %1$s will be stopped.",
          serviceName);

      stop(new StopStatus(GlobalConstants.EXIT_CODE_LAUNCHER_NON_TRANSIENT_FAILED, true, null, e));
      return false;
    } else {
      LOGGER.logError(e,
          "Exception occurred in %1$s. It should be transient. Will restart %1$s inplace.",
          serviceName);

      // TODO: Only Restart Service instead of exit whole process and Restart by external system.
      stop(new StopStatus(GlobalConstants.EXIT_CODE_LAUNCHER_UNKNOWN_FAILED, false, null, e));
      return true;
    }
  }

  @Override
  protected void initialize() throws Exception {
    super.initialize();
    transitionFrameworkStateQueue = new SystemTaskQueue(this::handleException);

    // Initialize Configurations
    conf = YamlUtils.toObject(GlobalConstants.LAUNCHER_CONFIG_FILE, LauncherConfiguration.class);
    CommonValidation.validate(conf);

    if (new File(GlobalConstants.USER_CONTAINER_EXIT_SPEC_FILE).exists()) {
      userContainerExitSpec = FrameworkExitSpec.initialize(
          YamlUtils.toObject(GlobalConstants.USER_CONTAINER_EXIT_SPEC_FILE, UserContainerExitSpec.class));
    }

    // Initialize SubServices
    yarnClient = YarnClient.createYarnClient();
    yarnClient.init(yarnConf);
    yarnClient.start();

    // Initialize Launcher Store
    zkStore = new ZookeeperStore(conf.getZkConnectString(), conf.getZkRootDir());
    hdfsStore = new HdfsStore(conf.getHdfsRootDir());

    // Initialize other components
    statusManager = new StatusManager(this, conf, userContainerExitSpec, zkStore);
    requestManager = new RequestManager(this, conf, zkStore);
    rmResyncHandler = new RMResyncHandler(this, conf, yarnClient, statusManager);
    amDiagnosticsRetriever = new AMDiagnosticsRetriever(this, conf, yarnClient);

    // Initialize External Service
    webServer = new WebServer(conf, zkStore);

    // Log Initialized Configuration
    LOGGER.logSplittedLines(Level.INFO,
        "Initialized %s with Configuration:\n%s",
        serviceName, WebCommon.toJson(conf));
  }

  @Override
  protected void recover() throws Exception {
    super.recover();
    statusManager.start();

    // Here StatusManager recover completed
    reviseCorruptedFrameworkStates();
    recoverTransitionFrameworkStateQueue();
  }

  @Override
  protected void run() throws Exception {
    super.run();

    // Start ExternalServices
    webServer.start();
    gcLeftoverFrameworks();

    // Run RequestManager depends on WebServer and gcLeftoverFrameworks
    requestManager.start();
  }

  // THREAD SAFE
  @Override
  public synchronized void stop(StopStatus stopStatus) {
    // Best Effort to stop Gracefully
    super.stop(stopStatus);

    AggregateException ae = new AggregateException();

    // Stop Service's SubServices
    try {
      if (yarnClient != null) {
        yarnClient.stop();
      }
    } catch (Exception e) {
      ae.addException(e);
    }

    if (ae.getExceptions().size() > 0) {
      LOGGER.logWarning(ae, "Failed to stop %s gracefully", serviceName);
    }

    LOGGER.logInfo("%s stopped", serviceName);
    System.exit(stopStatus.getCode());
  }


  /**
   * REGION InternalUtils
   */
  // GC Framework level external resource [HDFS] for LeftoverFrameworks.
  // LeftoverFrameworks may be caused by HDFS down, race condition, etc.
  private void gcLeftoverFrameworks() throws Exception {
    Set<String> frameworkNamesInStatus = statusManager.getFrameworkNames();
    Set<String> frameworkNamesInHdfs = hdfsStore.getFrameworkNames();
    String logPrefix = "gcLeftoverFrameworks: ";

    LOGGER.logInfo(logPrefix +
            "Started: Frameworks in HDFS: [%s], Frameworks in Status: [%s]",
        frameworkNamesInHdfs.size(), frameworkNamesInStatus.size());

    ExecutorService taskExecutor = Executors.newFixedThreadPool(20);
    List<Callable<String>> tasks = new ArrayList<>();
    for (String frameworkNameInHdfs : frameworkNamesInHdfs) {
      if (!frameworkNamesInStatus.contains(frameworkNameInHdfs)) {
        tasks.add(() -> {
          hdfsStore.removeFrameworkRoot(frameworkNameInHdfs);
          return frameworkNameInHdfs;
        });
        if (conf.getFrameworkLeftoverGCMaxCount() != GlobalConstants.USING_UNLIMITED_VALUE &&
            tasks.size() >= conf.getFrameworkLeftoverGCMaxCount()) {
          break;
        }
      }
    }
    taskExecutor.invokeAll(tasks);

    LOGGER.logInfo(logPrefix +
            "Succeeded: Frameworks in HDFS: [%s], Frameworks in Status: [%s]",
        frameworkNamesInHdfs.size() - tasks.size(), frameworkNamesInStatus.size());
  }

  private ContainerLaunchContext setupContainerLaunchContext(
      FrameworkStatus frameworkStatus,
      FrameworkRequest frameworkRequest,
      Resource amResource) throws Exception {
    AMType amType = frameworkRequest.getFrameworkDescriptor().getPlatformSpecificParameters().getAmType();
    switch (amType) {
      case DEFAULT:
      default: {
        if (amType != AMType.DEFAULT) {
          LOGGER.logWarning("Unsupported AM type: [%s]. Using the default AM instead.", amType);
        }
        return setupContainerLaunchContextForDefaultAM(frameworkStatus, frameworkRequest, amResource);
      }
    }
  }

  private ContainerLaunchContext setupContainerLaunchContextForDefaultAM(
      FrameworkStatus frameworkStatus,
      FrameworkRequest frameworkRequest,
      Resource amResource) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();
    Integer frameworkVersion = frameworkStatus.getFrameworkVersion();
    UserDescriptor loggedInUser = statusManager.getLoggedInUser();

    // SetupLocalResources
    Map<String, LocalResource> localResources = new HashMap<>();
    hdfsStore.makeFrameworkRootDir(frameworkName);
    hdfsStore.makeUserStoreRootDir(frameworkName);
    HadoopUtils.invalidateLocalResourcesCache();
    HadoopUtils.addToLocalResources(localResources, hdfsStore.uploadAMPackageFile(frameworkName));

    // SetupLocalEnvironment
    Map<String, String> localEnvs = new HashMap<>();

    // Internal class is preferred over external class
    localEnvs.put(ApplicationConstants.Environment.CLASSPATH_PREPEND_DISTCACHE.name(), "true");
    StringBuilder classpath = new StringBuilder("*");
    for (String c : yarnConf.getStrings(
        YarnConfiguration.YARN_APPLICATION_CLASSPATH,
        YarnConfiguration.DEFAULT_YARN_CROSS_PLATFORM_APPLICATION_CLASSPATH)) {
      classpath.append(ApplicationConstants.CLASS_PATH_SEPARATOR).append(c.trim());
    }
    classpath.append(ApplicationConstants.CLASS_PATH_SEPARATOR).append(ApplicationConstants.Environment.CLASSPATH.$$());
    localEnvs.put(GlobalConstants.ENV_VAR_CLASSPATH, classpath.toString());
    localEnvs.put(GlobalConstants.ENV_VAR_LAUNCHER_LOG_DIR, ApplicationConstants.LOG_DIR_EXPANSION_VAR);

    // Use the user for LauncherAM the same as LauncherService, since they are all Launcher executables.
    localEnvs.put(GlobalConstants.ENV_VAR_HADOOP_USER_NAME, loggedInUser.getName());

    localEnvs.put(GlobalConstants.ENV_VAR_FRAMEWORK_NAME, frameworkName);
    localEnvs.put(GlobalConstants.ENV_VAR_FRAMEWORK_VERSION, frameworkVersion.toString());

    localEnvs.put(GlobalConstants.ENV_VAR_ZK_CONNECT_STRING, conf.getZkConnectString());
    localEnvs.put(GlobalConstants.ENV_VAR_ZK_ROOT_DIR, conf.getZkRootDir());
    localEnvs.put(GlobalConstants.ENV_VAR_AM_VERSION, conf.getAmVersion().toString());
    localEnvs.put(GlobalConstants.ENV_VAR_AM_RM_HEARTBEAT_INTERVAL_SEC, conf.getAmRmHeartbeatIntervalSec().toString());

    // SetupEntryPoint
    Vector<CharSequence> vargs = new Vector<>(30);
    vargs.add(ApplicationConstants.Environment.JAVA_HOME.$$() + "/bin/java");
    vargs.add("-D" + GlobalConstants.ENV_VAR_LAUNCHER_LOG_DIR + "=" + GlobalConstants.REF_ENV_VAR_LAUNCHER_LOG_DIR);
    vargs.add("-Xmx" + amResource.getMemory() + "m");
    vargs.add(GlobalConstants.MAIN_CLASS_APPLICATION_MASTER);
    vargs.add(String.format(
        "1>%1$sstdout 2>%1$sstderr",
        GlobalConstants.REF_ENV_VAR_LAUNCHER_LOG_DIR + File.separator));

    StringBuilder command = new StringBuilder();
    for (CharSequence str : vargs) {
      command.append(str).append(" ");
    }
    List<String> commands = new ArrayList<>();
    commands.add(command.toString());

    // SetupSecurityTokens
    ByteBuffer fsTokens = null;
    if (UserGroupInformation.isSecurityEnabled()) {
      // Note: Credentials class is marked as LimitedPrivate for HDFS and MapReduce
      Credentials credentials = new Credentials();
      String tokenRenewer = yarnConf.get(YarnConfiguration.RM_PRINCIPAL);
      FileSystem fs = FileSystem.get(yarnConf);
      if (tokenRenewer == null || tokenRenewer.length() == 0) {
        throw new IOException(
            "Can't get Master Kerberos principal for the RM to use as renewer");
      }

      // For now, only getting tokens for the default file-system.
      final org.apache.hadoop.security.token.Token<?> tokens[] =
          fs.addDelegationTokens(tokenRenewer, credentials);
      if (tokens != null) {
        for (org.apache.hadoop.security.token.Token<?> token : tokens) {
          LOGGER.logInfo("Got dt for " + fs.getUri() + "; " + token);
        }
      }
      DataOutputBuffer dob = new DataOutputBuffer();
      credentials.writeTokenStorageToStream(dob);
      fsTokens = ByteBuffer.wrap(dob.getData(), 0, dob.getLength());
    }

    return ContainerLaunchContext.newInstance(
        localResources, localEnvs, commands, null, fsTokens, null);
  }

  private void setupApplicationContext(
      FrameworkStatus frameworkStatus,
      ApplicationSubmissionContext applicationContext) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();
    Integer frameworkVersion = frameworkStatus.getFrameworkVersion();
    String applicationId = frameworkStatus.getApplicationId();
    String logPrefix = String.format(
        "[%s][%s][%s]: setupApplicationContext: ",
        frameworkName, frameworkVersion, applicationId);

    // Ensure FrameworkStatus is unchanged.
    if (!statusManager.containsFramework(frameworkStatus)) {
      LOGGER.logWarning(logPrefix + "Framework not found in Status. Ignore it.");
      return;
    }

    FrameworkRequest frameworkRequest = requestManager.tryGetFrameworkRequest(frameworkName, frameworkVersion);
    if (frameworkRequest == null) {
      LOGGER.logWarning(logPrefix + "Framework not found in Request. Ignore it.");
      return;
    }

    PlatformSpecificParametersDescriptor platParams = frameworkRequest.getFrameworkDescriptor().getPlatformSpecificParameters();

    String applicationName = String.format(
        "[%s]_[%s]_[%s]_[%s]_[%s]",
        frameworkName, frameworkVersion,
        frameworkRequest.getLaunchClientType(),
        frameworkRequest.getLaunchClientHostName(),
        frameworkRequest.getLaunchClientUserName());

    Resource resource = platParams.getAmResource().toResource();

    applicationContext.setApplicationName(applicationName);
    applicationContext.setApplicationType(GlobalConstants.LAUNCHER_APPLICATION_TYPE);
    applicationContext.setAMContainerSpec(setupContainerLaunchContext(frameworkStatus, frameworkRequest, resource));

    Priority priority = Priority.newInstance(conf.getAmPriority());
    applicationContext.setResource(resource);
    applicationContext.setPriority(priority);

    ResourceRequest resourceRequest = ResourceRequest.newInstance(priority, "*", resource, 1);
    if (platParams.getAmNodeLabel() != null) {
      resourceRequest.setNodeLabelExpression(platParams.getAmNodeLabel());
      applicationContext.setNodeLabelExpression(platParams.getAmNodeLabel());
    }
    applicationContext.setAMContainerResourceRequest(resourceRequest);

    if (platParams.getQueue() != null) {
      applicationContext.setQueue(platParams.getQueue());
    }

    // Always enable Work-Preserving AM Restart
    applicationContext.setKeepContainersAcrossApplicationAttempts(true);
    applicationContext.setMaxAppAttempts(conf.getAmAttemptMaxCount());
    applicationContext.setAttemptFailuresValidityInterval(conf.getAmAttemptFailuresValidityIntervalSec() * 1000);

    // Queue launchApplication to avoid race condition
    transitionFrameworkStateQueue.queueSystemTask(() -> {
      launchApplication(frameworkStatus, applicationContext);
    });
  }


  /**
   * REGION FrameworkStateMachine
   */
  // Method which will cause transitionFrameworkState
  // Note they should be called in single thread, such as from transitionFrameworkStateQueue

  // Should be called after StatusManager recover completed
  private void reviseCorruptedFrameworkStates() throws Exception {
    LOGGER.logInfo(
        "reviseCorruptedFrameworkStates: %s",
        CommonExts.toString(FrameworkStateDefinition.STATE_CORRUPTED_AFTER_RESTART_STATES));

    List<FrameworkStatus> corruptedFrameworkStatuses = statusManager.getFrameworkStatus(FrameworkStateDefinition.STATE_CORRUPTED_AFTER_RESTART_STATES);
    for (FrameworkStatus frameworkStatus : corruptedFrameworkStatuses) {
      FrameworkState frameworkState = frameworkStatus.getFrameworkState();
      String frameworkName = frameworkStatus.getFrameworkName();

      // Previous Created Application will lost the ApplicationSubmissionContext object to Launch after AM Restart
      // Because misjudge a ground truth Running Application to be FRAMEWORK_WAITING (lose Framework) is more serious than
      // misjudge a ground truth not Running Application to Running. (The misjudged Application will be completed
      // by RMResync eventually, so the only impact is longer time to run the Framework)
      if (frameworkState == FrameworkState.APPLICATION_CREATED) {
        statusManager.transitionFrameworkState(frameworkName, FrameworkState.APPLICATION_LAUNCHED);
      }
    }
  }

  private void recoverTransitionFrameworkStateQueue() {
    // No need to recover TransitionFrameworkStateQueue for:
    // 1. STATE_CORRUPTED_AFTER_RESTART_STATES, since they are revised to other States by reviseCorruptedFrameworkStates
    // 2. APPLICATION_LAUNCHED, APPLICATION_RUNNING, since they can be handled by RMResyncHandler
    // 3. FRAMEWORK_COMPLETED, since it is FinalState
    LOGGER.logInfo(
        "recoverTransitionFrameworkStateQueue for FrameworkStates: %s",
        CommonExts.toString(FrameworkStateDefinition.QUEUE_CORRUPTED_AFTER_RESTART_STATES));

    // There may be a lot of corrupted System.Frameworks, so we queue them as one System.Framework per State
    transitionFrameworkStateQueue.queueSystemTask(() -> {
      createApplication();
    });
    LOGGER.logInfo("All the previous FRAMEWORK_WAITING Frameworks have been driven");

    transitionFrameworkStateQueue.queueSystemTask(() -> {
      retrieveApplicationExitDiagnostics();
    });
    LOGGER.logInfo("All the previous APPLICATION_RETRIEVING_DIAGNOSTICS Frameworks have been driven");

    transitionFrameworkStateQueue.queueSystemTask(() -> {
      attemptToRetry();
    });
    LOGGER.logInfo("All the previous APPLICATION_COMPLETED Frameworks have been driven");
  }

  private void completeApplication(
      FrameworkStatus frameworkStatus, int exitCode, String exitDiagnostics,
      String triggerMessage, String triggerTaskRoleName, Integer triggerTaskIndex) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();
    String applicationId = frameworkStatus.getApplicationId();

    LOGGER.logSplittedLines(Level.INFO,
        "[%s][%s]: completeApplication: ExitCode: %s, ExitDiagnostics: %s, " +
            "TriggerMessage: %s, TriggerTaskRoleName: %s, TriggerTaskIndex: %s",
        frameworkName, applicationId, exitCode, exitDiagnostics,
        triggerMessage, triggerTaskRoleName, triggerTaskIndex);

    statusManager.transitionFrameworkState(frameworkName, FrameworkState.APPLICATION_COMPLETED,
        new FrameworkEvent()
            .setApplicationExitCode(exitCode)
            .setApplicationExitDiagnostics(exitDiagnostics)
            .setApplicationExitTriggerMessage(triggerMessage)
            .setApplicationExitTriggerTaskRoleName(triggerTaskRoleName)
            .setApplicationExitTriggerTaskIndex(triggerTaskIndex));
    attemptToRetry(frameworkStatus);
  }

  // retrieveApplicationExitDiagnostics to prepare completeApplication
  private void retrieveApplicationExitDiagnostics(
      String applicationId, Integer exitCode, String exitDiagnostics, boolean needToKill) throws Exception {
    if (needToKill) {
      HadoopUtils.killApplication(applicationId);
    }

    String logSuffix = String.format(
        "[%s]: retrieveApplicationExitDiagnostics: ExitCode: %s, ExitDiagnostics: %s, NeedToKill: %s",
        applicationId, exitCode, exitDiagnostics, needToKill);

    if (!statusManager.isApplicationIdAssociated(applicationId)) {
      LOGGER.logWarning("[NotAssociated]%s", logSuffix);
      return;
    }

    FrameworkStatus frameworkStatus = statusManager.getFrameworkStatusWithAssociatedApplicationId(applicationId);
    String frameworkName = frameworkStatus.getFrameworkName();

    // Retrieve ExitDiagnostics
    LOGGER.logDebug("[%s]%s", frameworkName, logSuffix);

    // Just used to checkpoint ExitCode and ExitDiagnostics,
    // the ExitCode can be null and the ExitDiagnostics can be AMDiagnostics.
    statusManager.transitionFrameworkState(frameworkName, FrameworkState.APPLICATION_RETRIEVING_DIAGNOSTICS,
        new FrameworkEvent().setApplicationExitCode(exitCode).setApplicationExitDiagnostics(exitDiagnostics));

    if (exitCode == null || exitCode == FrameworkExitCode.SUCCEEDED.toInt()) {
      // The exitDiagnostics must be AMDiagnostics.
      if (AMDiagnostics.equalEmpty(exitDiagnostics)) {
        amDiagnosticsRetriever.retrieveAsync(applicationId);
        return;
      }
    }

    retrieveApplicationExitCode(applicationId, exitDiagnostics, null);
  }

  private void retrieveApplicationExitDiagnostics() throws Exception {
    for (FrameworkStatus frameworkStatus : statusManager.getFrameworkStatus(
        new HashSet<>(Collections.singletonList(FrameworkState.APPLICATION_RETRIEVING_DIAGNOSTICS)))) {
      // No need to kill, since if a Framework is in APPLICATION_RETRIEVING_DIAGNOSTICS,
      // it is guaranteed to be already killed.
      retrieveApplicationExitDiagnostics(
          frameworkStatus.getApplicationId(),
          frameworkStatus.getApplicationExitCode(),
          frameworkStatus.getApplicationExitDiagnostics(),
          false);
    }
  }

  // retrieveApplicationExitCode to prepare completeApplication
  private void retrieveApplicationExitCode(
      String applicationId, String exitDiagnostics, Exception exitDiagnosticsRetrieveException) throws Exception {
    String logSuffix = String.format(
        "[%s]: retrieveApplicationExitCode: ExitDiagnostics: %s",
        applicationId, exitDiagnostics);

    if (!statusManager.isApplicationIdAssociated(applicationId)) {
      LOGGER.logWarning("[NotAssociated]%s", logSuffix);
      return;
    }

    FrameworkStatus frameworkStatus = statusManager.getFrameworkStatusWithAssociatedApplicationId(applicationId);
    FrameworkState frameworkState = frameworkStatus.getFrameworkState();
    String frameworkName = frameworkStatus.getFrameworkName();
    Integer exitCode = frameworkStatus.getApplicationExitCode();

    if (frameworkState != FrameworkState.APPLICATION_RETRIEVING_DIAGNOSTICS) {
      LOGGER.logWarning("[%s]%s. Current FrameworkState %s is not %s. Ignore it.",
          frameworkName, logSuffix, frameworkState, FrameworkState.APPLICATION_RETRIEVING_DIAGNOSTICS);
      return;
    }

    // Retrieve ExitCode and other exit info
    LOGGER.logDebug("[%s]%s", frameworkName, logSuffix);

    String triggerMessage = null;
    String triggerTaskRoleName = null;
    Integer triggerTaskIndex = null;
    if (exitCode == null || exitCode == FrameworkExitCode.SUCCEEDED.toInt()) {
      // The exitDiagnostics must be AMDiagnostics which contains more exit info from AM.
      AMDiagnostics amDiagnostics;
      if (AMDiagnostics.equalEmpty(exitDiagnostics)) {
        amDiagnostics = AMDiagnostics.generate(
            FrameworkExitCode.APP_AM_DIAGNOSTICS_LOST.toInt(),
            String.format(
                "Cannot get more exit info due to retrieved empty AMDiagnostics: %s",
                CommonUtils.toDiagnostics(exitDiagnosticsRetrieveException)),
            null, null, null);
      } else {
        try {
          amDiagnostics = AMDiagnostics.deserialize(exitDiagnostics);
        } catch (Exception e) {
          amDiagnostics = AMDiagnostics.generate(
              FrameworkExitCode.APP_AM_DIAGNOSTICS_DESERIALIZATION_FAILED.toInt(),
              String.format(
                  "Cannot get more exit info due to failed to deserialize AMDiagnostics: %s" +
                      "\nAMDiagnostics:\n[%s]",
                  CommonUtils.toDiagnostics(e), exitDiagnostics),
              null, null, null);
        }
      }

      if (exitCode == null) {
        // Only override null exitCode
        exitCode = amDiagnostics.getApplicationExitCode();
      }
      exitDiagnostics = amDiagnostics.getApplicationExitDiagnostics();
      triggerMessage = amDiagnostics.getApplicationExitTriggerMessage();
      triggerTaskRoleName = amDiagnostics.getApplicationExitTriggerTaskRoleName();
      triggerTaskIndex = amDiagnostics.getApplicationExitTriggerTaskIndex();
    }

    completeApplication(
        frameworkStatus, exitCode, exitDiagnostics,
        triggerMessage, triggerTaskRoleName, triggerTaskIndex);
  }

  private void launchApplication(FrameworkStatus frameworkStatus, ApplicationSubmissionContext applicationContext) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();
    Integer frameworkVersion = frameworkStatus.getFrameworkVersion();
    String applicationId = frameworkStatus.getApplicationId();
    String logPrefix = String.format(
        "[%s][%s][%s]: launchApplication: ",
        frameworkName, frameworkVersion, applicationId);

    // Ensure FrameworkStatus is unchanged.
    if (!statusManager.containsFramework(frameworkStatus)) {
      LOGGER.logWarning(logPrefix + "Framework not found in Status. Ignore it.");
      return;
    }

    FrameworkRequest frameworkRequest = requestManager.tryGetFrameworkRequest(frameworkName, frameworkVersion);
    if (frameworkRequest == null) {
      LOGGER.logWarning(logPrefix + "Framework not found in Request. Ignore it.");
      return;
    }
    UserDescriptor user = frameworkRequest.getFrameworkDescriptor().getUser();

    logPrefix += "SubmitApplication: ";
    try {
      LOGGER.logInfo(logPrefix + "ApplicationName: %s", applicationContext.getApplicationName());
      LOGGER.logInfo(logPrefix + "ResourceRequest: %s", HadoopExts.toString(applicationContext.getAMContainerResourceRequest()));
      LOGGER.logInfo(logPrefix + "Queue: %s", applicationContext.getQueue());

      HadoopUtils.submitApplication(applicationContext, user);

      LOGGER.logInfo(logPrefix + "Succeeded");
    } catch (Throwable e) {
      LOGGER.logWarning(e, logPrefix + "Failed");

      // YarnException indicates exceptions from yarn servers, and IOException indicates exceptions from RPC layer.
      // So, consider YarnException as NonTransientError, and IOException as TransientError.
      if (e instanceof YarnException) {
        retrieveApplicationExitDiagnostics(
            applicationId,
            FrameworkExitCode.APP_SUBMISSION_YARN_EXCEPTION.toInt(),
            CommonUtils.toDiagnostics(e),
            true);
        return;
      } else if (e instanceof IOException) {
        retrieveApplicationExitDiagnostics(
            applicationId,
            FrameworkExitCode.APP_SUBMISSION_IO_EXCEPTION.toInt(),
            CommonUtils.toDiagnostics(e),
            true);
        return;
      } else {
        retrieveApplicationExitDiagnostics(
            applicationId,
            FrameworkExitCode.APP_SUBMISSION_UNKNOWN_EXCEPTION.toInt(),
            CommonUtils.toDiagnostics(e),
            true);
        return;
      }
    }

    statusManager.transitionFrameworkState(frameworkName, FrameworkState.APPLICATION_LAUNCHED);
  }

  private void createApplication(FrameworkStatus frameworkStatus, boolean isPlaceholderApplication) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();
    ApplicationSubmissionContext applicationContext = yarnClient.createApplication().getApplicationSubmissionContext();
    statusManager.transitionFrameworkState(frameworkName, FrameworkState.APPLICATION_CREATED,
        new FrameworkEvent().setApplicationContext(applicationContext).setSkipToPersist(isPlaceholderApplication));

    if (!isPlaceholderApplication) {
      // Concurrently setupApplicationContext
      FrameworkStatus frameworkStatusSnapshot = YamlUtils.deepCopy(frameworkStatus, FrameworkStatus.class);
      new Thread(() -> {
        try {
          // Always Setup a brand new ApplicationContext to tolerate ApplicationContext corruption,
          // such as HDFS data lost.
          // Retry to setupApplicationContext due to the race condition with onFrameworkToRemove.
          RetryUtils.executeWithRetry(() -> {
                setupApplicationContext(frameworkStatusSnapshot, applicationContext);
              },
              conf.getApplicationSetupContextMaxRetryCount(),
              conf.getApplicationSetupContextRetryIntervalSec(), null);
        } catch (Exception e) {
          onExceptionOccurred(e);
        }
      }).start();
    }
  }

  private void createApplication() throws Exception {
    for (FrameworkStatus frameworkStatus : statusManager.getFrameworkStatus(
        new HashSet<>(Collections.singletonList(FrameworkState.FRAMEWORK_WAITING)))) {
      createApplication(frameworkStatus, false);
    }
  }

  private void completeFramework(FrameworkStatus frameworkStatus) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();

    LOGGER.logSplittedLines(Level.INFO,
        "%s: completeFramework: FrameworkStatus:\n%s",
        frameworkName, WebCommon.toJson(frameworkStatus));

    statusManager.transitionFrameworkState(frameworkName, FrameworkState.FRAMEWORK_COMPLETED);
  }

  private void retryFramework(FrameworkStatus frameworkStatus, RetryPolicyState newRetryPolicyState) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();
    Integer frameworkVersion = frameworkStatus.getFrameworkVersion();
    String logPrefix = String.format(
        "[%s][%s]: retryFramework: ", frameworkName, frameworkVersion);

    // Ensure FrameworkStatus is unchanged.
    if (!statusManager.containsFramework(frameworkStatus)) {
      LOGGER.logWarning(logPrefix + "Framework not found in Status. Ignore it.");
      return;
    }
    frameworkStatus = statusManager.getFrameworkStatus(frameworkName);

    LOGGER.logSplittedLines(Level.INFO,
        logPrefix + "NewRetryPolicyState:\n%s",
        WebCommon.toJson(newRetryPolicyState));

    statusManager.transitionFrameworkState(frameworkName, FrameworkState.FRAMEWORK_WAITING,
        new FrameworkEvent().setNewRetryPolicyState(newRetryPolicyState));
    createApplication(frameworkStatus, false);
  }

  // Implement FrameworkRetryPolicy
  private void attemptToRetry(FrameworkStatus frameworkStatus) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();
    Integer exitCode = frameworkStatus.getApplicationExitCode();
    ExitType exitType = frameworkStatus.getApplicationExitType();
    Integer retriedCount = frameworkStatus.getFrameworkRetryPolicyState().getRetriedCount();
    RetryPolicyState newRetryPolicyState = YamlUtils.deepCopy(frameworkStatus.getFrameworkRetryPolicyState(), RetryPolicyState.class);
    Integer transientConflictRetriedCount = frameworkStatus.getFrameworkRetryPolicyState().getTransientConflictRetriedCount();
    String logPrefix = String.format("[%s]: attemptToRetry: ", frameworkName);

    FrameworkRequest frameworkRequest = requestManager.tryGetFrameworkRequest(frameworkName, frameworkStatus.getFrameworkVersion());
    if (frameworkRequest == null) {
      LOGGER.logWarning(logPrefix + "Framework not found in Request. Ignore it.");
      return;
    }

    RetryPolicyDescriptor retryPolicy = frameworkRequest.getFrameworkDescriptor().getRetryPolicy();
    Boolean fancyRetryPolicy = retryPolicy.getFancyRetryPolicy();
    Integer maxRetryCount = retryPolicy.getMaxRetryCount();

    LOGGER.logSplittedLines(Level.INFO,
        logPrefix + "ApplicationExitCode: [%s], ApplicationExitType: [%s], RetryPolicyState:\n[%s]",
        exitCode, exitType, WebCommon.toJson(newRetryPolicyState));

    String completeFrameworkLogPrefix = logPrefix + "Will completeFramework. Reason: ";
    String retryFrameworkLogPrefix = logPrefix + "Will retryFramework with new Application. Reason: ";

    // 1. FancyRetryPolicy
    String fancyRetryPolicyLogSuffix = String.format("FancyRetryPolicy: Framework exited due to %s.", exitType);
    if (exitType == ExitType.TRANSIENT_NORMAL) {
      newRetryPolicyState.setTransientNormalRetriedCount(newRetryPolicyState.getTransientNormalRetriedCount() + 1);
      if (fancyRetryPolicy) {
        LOGGER.logWarning(retryFrameworkLogPrefix + fancyRetryPolicyLogSuffix);
        retryFramework(frameworkStatus, newRetryPolicyState);
        return;
      }
    } else if (exitType == ExitType.TRANSIENT_CONFLICT) {
      newRetryPolicyState.setTransientConflictRetriedCount(newRetryPolicyState.getTransientConflictRetriedCount() + 1);
      if (fancyRetryPolicy) {
        int delaySec = RetryUtils.calcRandomBackoffDelay(
            transientConflictRetriedCount,
            conf.getApplicationTransientConflictMinDelaySec(),
            conf.getApplicationTransientConflictMaxDelaySec());

        LOGGER.logWarning(logPrefix +
            "Will retryFramework with new Application after %ss. Reason: " +
            fancyRetryPolicyLogSuffix, delaySec);

        FrameworkStatus frameworkStatusSnapshot = YamlUtils.deepCopy(frameworkStatus, FrameworkStatus.class);
        transitionFrameworkStateQueue.queueSystemTaskDelayed(() -> {
          retryFramework(frameworkStatusSnapshot, newRetryPolicyState);
        }, delaySec * 1000);
        return;
      }
    } else if (exitType == ExitType.NON_TRANSIENT) {
      newRetryPolicyState.setNonTransientRetriedCount(newRetryPolicyState.getNonTransientRetriedCount() + 1);
      if (fancyRetryPolicy) {
        LOGGER.logWarning(completeFrameworkLogPrefix + fancyRetryPolicyLogSuffix);
        completeFramework(frameworkStatus);
        return;
      }
    } else {
      if (exitType == ExitType.SUCCEEDED) {
        newRetryPolicyState.setSucceededRetriedCount(newRetryPolicyState.getSucceededRetriedCount() + 1);
      } else {
        newRetryPolicyState.setUnKnownRetriedCount(newRetryPolicyState.getUnKnownRetriedCount() + 1);
      }
      if (fancyRetryPolicy) {
        // FancyRetryPolicy only handle exit due to transient and non-transient failure specially,
        // Leave exit due to others to NormalRetryPolicy
        LOGGER.logInfo(logPrefix +
            "Transfer the RetryDecision to NormalRetryPolicy. Reason: " +
            fancyRetryPolicyLogSuffix);
      }
    }

    // 2. NormalRetryPolicy
    if (maxRetryCount == GlobalConstants.USING_EXTENDED_UNLIMITED_VALUE ||
        (exitType != ExitType.SUCCEEDED && maxRetryCount == GlobalConstants.USING_UNLIMITED_VALUE) ||
        (exitType != ExitType.SUCCEEDED && retriedCount < maxRetryCount)) {
      newRetryPolicyState.setRetriedCount(newRetryPolicyState.getRetriedCount() + 1);

      LOGGER.logWarning(retryFrameworkLogPrefix +
              "RetriedCount %s has not reached MaxRetryCount %s.",
          retriedCount, maxRetryCount);
      retryFramework(frameworkStatus, newRetryPolicyState);
      return;
    } else {
      if (exitType == ExitType.SUCCEEDED) {
        LOGGER.logInfo(completeFrameworkLogPrefix +
            "Framework exited due to %s.", exitType);
        completeFramework(frameworkStatus);
        return;
      } else {
        LOGGER.logWarning(completeFrameworkLogPrefix +
                "RetriedCount %s has reached MaxRetryCount %s.",
            retriedCount, maxRetryCount);
        completeFramework(frameworkStatus);
        return;
      }
    }
  }

  private void attemptToRetry() throws Exception {
    for (FrameworkStatus frameworkStatus : statusManager.getFrameworkStatus(
        new HashSet<>(Collections.singletonList(FrameworkState.APPLICATION_COMPLETED)))) {
      attemptToRetry(frameworkStatus);
    }
  }

  private void resyncFrameworksWithLiveApplications(Map<String, ApplicationReport> liveApplicationReports) throws Exception {
    // Since Application is persistent in ZK by RM, so liveApplicationReports will never incomplete.
    String logScope = "resyncFrameworksWithLiveApplications";
    CHANGE_AWARE_LOGGER.initializeScope(logScope, Level.INFO, Level.DEBUG);
    CHANGE_AWARE_LOGGER.log(logScope,
        "Got %s live Applications from RM, start to resync them.",
        liveApplicationReports.size());

    for (ApplicationReport applicationReport : liveApplicationReports.values()) {
      String applicationId = applicationReport.getApplicationId().toString();
      YarnApplicationState applicationState = applicationReport.getYarnApplicationState();
      FinalApplicationStatus applicationFinalStatus = applicationReport.getFinalApplicationStatus();
      String diagnostics = CommonUtils.trim(applicationReport.getDiagnostics());

      if (statusManager.isApplicationIdLiveAssociated(applicationId)) {
        FrameworkStatus frameworkStatus = statusManager.getFrameworkStatusWithLiveAssociatedApplicationId(applicationId);
        String frameworkName = frameworkStatus.getFrameworkName();
        FrameworkState frameworkState = frameworkStatus.getFrameworkState();
        if (frameworkState == FrameworkState.APPLICATION_CREATED) {
          continue;
        }

        // updateApplicationStatus
        statusManager.updateApplicationStatus(frameworkName, applicationReport);

        // transitionFrameworkState
        if (applicationFinalStatus == FinalApplicationStatus.UNDEFINED) {
          if (applicationState == YarnApplicationState.NEW ||
              applicationState == YarnApplicationState.NEW_SAVING ||
              applicationState == YarnApplicationState.SUBMITTED ||
              applicationState == YarnApplicationState.ACCEPTED) {
            statusManager.transitionFrameworkState(frameworkName, FrameworkState.APPLICATION_WAITING);
          } else if (applicationState == YarnApplicationState.RUNNING) {
            statusManager.transitionFrameworkState(frameworkName, FrameworkState.APPLICATION_RUNNING);
          }
        } else if (applicationFinalStatus == FinalApplicationStatus.SUCCEEDED) {
          retrieveApplicationExitDiagnostics(
              applicationId,
              FrameworkExitCode.SUCCEEDED.toInt(),
              diagnostics,
              false);
        } else if (applicationFinalStatus == FinalApplicationStatus.KILLED) {
          retrieveApplicationExitDiagnostics(
              applicationId,
              FrameworkExitCode.APP_KILLED_UNEXPECTEDLY.toInt(),
              diagnostics,
              false);
        } else if (applicationFinalStatus == FinalApplicationStatus.FAILED) {
          retrieveApplicationExitDiagnostics(
              applicationId,
              null,
              diagnostics,
              false);
        }
      } else {
        // Do not kill Application due to APP_RM_RESYNC_EXCEEDED, since Exceed AM will kill itself.
        // In this way, we can support multiple LauncherServices to share a single RM,
        // like the sharing of HDFS and ZK.
      }
    }

    List<String> liveAssociatedApplicationIds = statusManager.getLiveAssociatedApplicationIds();
    for (String applicationId : liveAssociatedApplicationIds) {
      if (!liveApplicationReports.containsKey(applicationId)) {
        FrameworkStatus frameworkStatus = statusManager.getFrameworkStatusWithLiveAssociatedApplicationId(applicationId);
        String frameworkName = frameworkStatus.getFrameworkName();
        FrameworkState frameworkState = frameworkStatus.getFrameworkState();

        // APPLICATION_CREATED Application is expected without ApplicationReport, but it is indeed live in RM.
        if (frameworkState == FrameworkState.APPLICATION_CREATED) {
          continue;
        }

        LOGGER.logWarning(
            "[%s]: Cannot find live associated Application %s in resynced live Applications. " +
                "Will complete it as RMResyncLost",
            frameworkName, applicationId);

        retrieveApplicationExitDiagnostics(
            applicationId,
            FrameworkExitCode.APP_RM_RESYNC_LOST.toInt(),
            null,
            false);
      }
    }
  }


  /**
   * REGION Callbacks
   */
  // Service integrate and process all Callbacks from all its SubServices
  // Note, if a Callback may change FrameworkState/FrameworkStatus, it should be queued in transitionFrameworkStateQueue
  // to let Callee(TaskQueue) to handle it in order.
  // Note:
  //  1. Queued SystemTask need to double check whether the input param still valid at the time being Executed.
  //  2. For Status: Do not queue SystemTask with Status as the input param otherwise need to double check its
  //  validity inside the SystemTask.
  //  3. For Request: Always need to double check the corresponding Request's validity inside the SystemTask,
  //  since RequestManager is not synchronized.
  // For Service:
  //  1. For Status: Queued Status is double checked.
  //  2. For Request: Request is double checked, except for onFrameworkRequestsUpdated since we need a Request snapshot anyway.

  // Callbacks from SubServices
  public void onExceptionOccurred(Exception e) {
    LOGGER.logInfo(e, "onExceptionOccurred");

    // Handle SubService Exception ASAP
    handleException(e);
  }

  // Callbacks from StatusManager and RequestManager
  // FrameworkName -> FrameworkRequest
  // Service may need to double check whether FrameworkRequests is changed or not according to StatusManager
  public void onFrameworkRequestsUpdated(Map<String, FrameworkRequest> frameworkRequests) {
    LOGGER.logInfo("onFrameworkRequestsUpdated: FrameworkRequests: [%s]", frameworkRequests.size());
    transitionFrameworkStateQueue.queueSystemTask(() -> {
      statusManager.updateFrameworkRequests(frameworkRequests);
      createApplication();
    });
  }

  // Cleanup Framework level external resource [HDFS, RM] before RemoveFramework.
  // onFrameworkToRemove is already in queue, so queue it again will disorder
  // the result of onFrameworkRequestsUpdated and other SystemTasks.
  public void onFrameworkToRemove(FrameworkStatus frameworkStatus, boolean usedToUpgrade) throws Exception {
    String frameworkName = frameworkStatus.getFrameworkName();
    String applicationId = frameworkStatus.getApplicationId();
    FrameworkState frameworkState = frameworkStatus.getFrameworkState();

    if (FrameworkStateDefinition.APPLICATION_LIVE_ASSOCIATED_STATES.contains(frameworkState)) {
      // No need to completeApplication, since it is to be Removed afterwards
      HadoopUtils.killApplication(applicationId);
    }

    if (!usedToUpgrade) {
      try {
        // Although remove Framework in HDFS is slow, it is still synchronized in queue to ensure that the
        // remove operation will not remove the Framework which is not to be removed.
        // Note that for the same Framework, there is race condition between the remove operation and
        // setupContainerLaunchContext, but the race condition is safe:
        // If the remove operation before or during the setupContainerLaunchContext,
        // the Framework is LeftoverFramework and it will be cleaned up by gcLeftoverFrameworks.
        // Otherwise, the Framework is removed totally and not need gcLeftoverFrameworks.
        hdfsStore.removeFrameworkRoot(frameworkName);
      } catch (Exception e) {
        // Best Effort to removeFrameworkRoot
        LOGGER.logWarning(e,
            "[%s]: onFrameworkToRemove: Failed to remove Framework in HDFS, will remove it later",
            frameworkName);
      }
    }
  }

  // Prepare and kill the associated Application of the Framework before StopFramework.
  // onFrameworkToStop is already in queue, so queue it again will disorder
  // the result of onFrameworkRequestsUpdated and other SystemTasks.
  public void onFrameworkToStop(FrameworkStatus frameworkStatus) throws Exception {
    String applicationId = frameworkStatus.getApplicationId();
    FrameworkState frameworkState = frameworkStatus.getFrameworkState();

    if (!FrameworkStateDefinition.APPLICATION_ASSOCIATED_STATES.contains(frameworkState)) {
      // Ensure a stopped Framework is always associated with an Application, so that the
      // Application's exit info can always reflect the Framework's exit info.
      createApplication(frameworkStatus, true);
    }

    if (FrameworkStateDefinition.APPLICATION_LIVE_ASSOCIATED_STATES.contains(frameworkState)) {
      // No need to completeApplication, since it is to be Stopped afterwards
      HadoopUtils.killApplication(applicationId);
    }
  }

  public void onStartRMResyncHandler() {
    LOGGER.logInfo("onStartRMResyncHandler");

    rmResyncHandler.start();

    LOGGER.logInfo("All the previous APPLICATION_LAUNCHED and APPLICATION_RUNNING Frameworks have been driven");
  }

  public void onStartTransitionFrameworkStateQueue() {
    LOGGER.logInfo("onStartTransitionFrameworkStateQueue");
    transitionFrameworkStateQueue.start();
    LOGGER.logInfo("Running TransitionFrameworkStateQueue");
  }


  // Callbacks from RMResyncHandler
  public void queueResyncWithRM(int delaySec) {
    transitionFrameworkStateQueue.queueSystemTaskDelayed(() -> {
      rmResyncHandler.resyncWithRM();
    }, delaySec * 1000);
  }

  // ApplicationId -> ApplicationReport
  public void onLiveApplicationsUpdated(Map<String, ApplicationReport> liveApplicationReports) throws Exception {
    LOGGER.logDebug("onLiveApplicationsUpdated: LiveApplications: [%s]", liveApplicationReports.size());

    // onLiveApplicationsUpdated is already in queue, so queue it again will disorder
    // the result of resyncWithRM and other SystemTasks
    resyncFrameworksWithLiveApplications(liveApplicationReports);
  }


  // Callbacks from AMDiagnosticsRetriever
  public void onAMDiagnosticsRetrieved(
      String applicationId, String amDiagnostics, Exception retrieveException) {
    transitionFrameworkStateQueue.queueSystemTask(() -> {
      retrieveApplicationExitCode(applicationId, amDiagnostics, retrieveException);
    });
  }
}
