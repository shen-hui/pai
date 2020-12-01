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

package com.microsoft.frameworklauncher.common.model;

import javax.validation.constraints.Pattern;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;

public class LauncherConfiguration implements Serializable {
  // Common Setup
  private String zkConnectString = "127.0.0.1:2181";
  private String zkRootDir = "/Launcher";
  private String hdfsRootDir = "/Launcher";
  private Set<UserDescriptor> rootAdminUsers = new HashSet<>();

  // Service Setup
  private Integer serviceRMResyncIntervalSec = 30;
  private Integer serviceRequestPullIntervalSec = 30;

  // Application Setup
  private Integer applicationRetrieveDiagnosticsRetryIntervalSec = 30;
  private Integer applicationRetrieveDiagnosticsMaxRetryCount = 15;
  private Integer applicationTransientConflictMinDelaySec = 600;
  private Integer applicationTransientConflictMaxDelaySec = 3600;
  private Integer applicationSetupContextMaxRetryCount = 3;
  private Integer applicationSetupContextRetryIntervalSec = 1;

  // Framework Setup
  // Completed Frameworks will ONLY be retained in recent FrameworkCompletedRetainSec,
  // in case Client miss to delete the Framework after FRAMEWORK_COMPLETED.
  // One exclusion is the Framework Launched by DataDeployment, it will be retained until
  // the corresponding FrameworkDescriptionFile deleted in the DataDeployment.
  // To avoid missing the CompletedFrameworkStatus, the polling interval seconds of Client
  // should be less than FrameworkCompletedRetainSec.
  private Long frameworkCompletedRetainSec = 43200L;
  // Leftover Frameworks has some external resource, such as HDFS, need to be GC when Service start.
  // FrameworkLeftoverGCMaxCount limit the max Framework count to be GC at each time, so that the
  // Service start time is also limited.
  private Integer frameworkLeftoverGCMaxCount = 1000;
  // Zookeeper is seriously degraded if its data size is larger than 1GB.
  // Here, we limit the Total TaskNumber to 500K, such that the Zookeeper data size used by Launcher
  // is also limited to 100MB = 500K * 200 bytes/task.
  private Integer maxTotalTaskNumber = 500000;

  // ApplicationMaster Setup
  private Integer amVersion = 0;
  private Integer amPriority = 1;
  // Should be less than {yarn.app.attempt.diagnostics.limit.kc}, which defaults to 64KB.
  private Integer amDiagnosticsMaxBytes = 49152;
  // Just in case AM cannot be gracefully Stopped and RM cannot judge its exit as transient,
  // such as AM process interrupted by external system, AM exit by FailFast, etc.
  private Integer amAttemptMaxCount = 3;
  private Integer amAttemptFailuresValidityIntervalSec = 10;

  // ApplicationMaster Internal Setup which should not be exposed to User
  private Integer amRmHeartbeatIntervalSec = 1;
  // The RMResync count in one NM expiry time.
  // RMResync can detect and process under-allocated(RMResyncLost), and over-allocated(RMResyncExceed)
  // Containers actively, instead of waiting the RM call back passively.
  // This feature can provide eventual consistency between AM and RM.
  private Integer amRmResyncFrequency = 6;
  private Integer amRmResyncNmExpiryBufferSec = 60;
  private Integer amRequestPullIntervalSec = 30;
  private Integer amStatusPushIntervalSec = 30;
  private Integer amFrameworkInfoPublishIntervalSec = 30;

  // If a Task's ContainerRequest cannot be satisfied within
  // Random(amContainerRequestMinTimeoutSec, amContainerRequestMaxTimeoutSec), another
  // ContainerRequest (maybe different from previous one) will be made for this Task.
  // This is useful for Gpu scheduling and multiple TaskRoles.
  // Note, before YARN-3983, high Priority ContainerRequest must be satisfied before low Priority ContainerRequest.
  // So, to avoid one ContainerRequest always blocks all ContainerRequests even after timeout, we timeout
  // ContainerRequest randomly.
  private Integer amContainerRequestMinTimeoutSec = 10;
  private Integer amContainerRequestMaxTimeoutSec = 200;

  // If a Task's ContainerRequest is NotAvailable when SetupContainerRequest,
  // AM will SetupContainerRequest for the Task again after 
  // Random(amSetupContainerRequestMinRetryIntervalSec, amSetupContainerRequestMaxRetryIntervalSec).
  private Integer amSetupContainerRequestMinRetryIntervalSec = 30;
  private Integer amSetupContainerRequestMaxRetryIntervalSec = 150;

  // If GangAllocation cannot be satisfied within this timeout, fails the whole application
  // with TRANSIENT_CONFLICT ExitType.
  // And then the Framework will be backoff retried if Framework FancyRetryPolicy is enabled.
  // It is suggested to be less than
  // yarn.resourcemanager.rm.container-allocation.expiry-interval-ms which is default to 600s,
  // so that the allocated container can be held before this timeout.
  private Integer amGangAllocationTimeoutSec = 500;

  // The minimum port to allocate to container, since small ports are usually reserved.
  private Integer amContainerMinPort = 2000;
  // The multiple of START_STATES Tasks which is used to consider more candidate nodes.
  private Integer amCandidateNodesFactor = 2;
  // If this feature is enabled, the container of a none Gpu job is allowed to be allocated on a
  // node with Gpu resource.
  private Boolean amAllowNoneGpuJobOnGpuNode = true;

  // WebServer Setup
  private String webServerBindHost = "0.0.0.0";
  @Pattern(regexp = "^https?://[^:^/]+:\\d+$")
  private String webServerAddress = "http://localhost:9086";
  private Integer webServerStatusPullIntervalSec = 30;
  private Boolean webServerAclEnable = false;
  // If this feature is enabled, ACL check will be ignored for Framework which does
  // not belong to any Namespace.
  // It should only be enabled to compatible with existing Framework which was PUT before
  // ACL is enabled.
  private Boolean webServerAclIgnoreWithoutNamespace = false;

  public String getZkConnectString() {
    return zkConnectString;
  }

  public void setZkConnectString(String zkConnectString) {
    this.zkConnectString = zkConnectString;
  }

  public String getZkRootDir() {
    return zkRootDir;
  }

  public void setZkRootDir(String zkRootDir) {
    this.zkRootDir = zkRootDir;
  }

  public String getHdfsRootDir() {
    return hdfsRootDir;
  }

  public void setHdfsRootDir(String hdfsRootDir) {
    this.hdfsRootDir = hdfsRootDir;
  }

  public Set<UserDescriptor> getRootAdminUsers() {
    return rootAdminUsers;
  }

  public void setRootAdminUsers(Set<UserDescriptor> rootAdminUsers) {
    this.rootAdminUsers = rootAdminUsers;
  }

  public Integer getServiceRMResyncIntervalSec() {
    return serviceRMResyncIntervalSec;
  }

  public void setServiceRMResyncIntervalSec(Integer serviceRMResyncIntervalSec) {
    this.serviceRMResyncIntervalSec = serviceRMResyncIntervalSec;
  }

  public Integer getServiceRequestPullIntervalSec() {
    return serviceRequestPullIntervalSec;
  }

  public void setServiceRequestPullIntervalSec(Integer serviceRequestPullIntervalSec) {
    this.serviceRequestPullIntervalSec = serviceRequestPullIntervalSec;
  }

  public Integer getApplicationRetrieveDiagnosticsRetryIntervalSec() {
    return applicationRetrieveDiagnosticsRetryIntervalSec;
  }

  public void setApplicationRetrieveDiagnosticsRetryIntervalSec(Integer applicationRetrieveDiagnosticsRetryIntervalSec) {
    this.applicationRetrieveDiagnosticsRetryIntervalSec = applicationRetrieveDiagnosticsRetryIntervalSec;
  }

  public Integer getApplicationRetrieveDiagnosticsMaxRetryCount() {
    return applicationRetrieveDiagnosticsMaxRetryCount;
  }

  public void setApplicationRetrieveDiagnosticsMaxRetryCount(Integer applicationRetrieveDiagnosticsMaxRetryCount) {
    this.applicationRetrieveDiagnosticsMaxRetryCount = applicationRetrieveDiagnosticsMaxRetryCount;
  }

  public Integer getApplicationTransientConflictMinDelaySec() {
    return applicationTransientConflictMinDelaySec;
  }

  public void setApplicationTransientConflictMinDelaySec(Integer applicationTransientConflictMinDelaySec) {
    this.applicationTransientConflictMinDelaySec = applicationTransientConflictMinDelaySec;
  }

  public Integer getApplicationTransientConflictMaxDelaySec() {
    return applicationTransientConflictMaxDelaySec;
  }

  public void setApplicationTransientConflictMaxDelaySec(Integer applicationTransientConflictMaxDelaySec) {
    this.applicationTransientConflictMaxDelaySec = applicationTransientConflictMaxDelaySec;
  }

  public Integer getApplicationSetupContextMaxRetryCount() {
    return applicationSetupContextMaxRetryCount;
  }

  public void setApplicationSetupContextMaxRetryCount(Integer applicationSetupContextMaxRetryCount) {
    this.applicationSetupContextMaxRetryCount = applicationSetupContextMaxRetryCount;
  }

  public Integer getApplicationSetupContextRetryIntervalSec() {
    return applicationSetupContextRetryIntervalSec;
  }

  public void setApplicationSetupContextRetryIntervalSec(Integer applicationSetupContextRetryIntervalSec) {
    this.applicationSetupContextRetryIntervalSec = applicationSetupContextRetryIntervalSec;
  }

  public Long getFrameworkCompletedRetainSec() {
    return frameworkCompletedRetainSec;
  }

  public void setFrameworkCompletedRetainSec(Long frameworkCompletedRetainSec) {
    this.frameworkCompletedRetainSec = frameworkCompletedRetainSec;
  }

  public Integer getFrameworkLeftoverGCMaxCount() {
    return frameworkLeftoverGCMaxCount;
  }

  public void setFrameworkLeftoverGCMaxCount(Integer frameworkLeftoverGCMaxCount) {
    this.frameworkLeftoverGCMaxCount = frameworkLeftoverGCMaxCount;
  }

  public Integer getMaxTotalTaskNumber() {
    return maxTotalTaskNumber;
  }

  public void setMaxTotalTaskNumber(Integer maxTotalTaskNumber) {
    this.maxTotalTaskNumber = maxTotalTaskNumber;
  }

  public Integer getAmVersion() {
    return amVersion;
  }

  public void setAmVersion(Integer amVersion) {
    this.amVersion = amVersion;
  }

  public Integer getAmPriority() {
    return amPriority;
  }

  public void setAmPriority(Integer amPriority) {
    this.amPriority = amPriority;
  }

  public Integer getAmDiagnosticsMaxBytes() {
    return amDiagnosticsMaxBytes;
  }

  public void setAmDiagnosticsMaxBytes(Integer amDiagnosticsMaxBytes) {
    this.amDiagnosticsMaxBytes = amDiagnosticsMaxBytes;
  }

  public Integer getAmAttemptMaxCount() {
    return amAttemptMaxCount;
  }

  public void setAmAttemptMaxCount(Integer amAttemptMaxCount) {
    this.amAttemptMaxCount = amAttemptMaxCount;
  }

  public Integer getAmAttemptFailuresValidityIntervalSec() {
    return amAttemptFailuresValidityIntervalSec;
  }

  public void setAmAttemptFailuresValidityIntervalSec(Integer amAttemptFailuresValidityIntervalSec) {
    this.amAttemptFailuresValidityIntervalSec = amAttemptFailuresValidityIntervalSec;
  }

  public Integer getAmRmHeartbeatIntervalSec() {
    return amRmHeartbeatIntervalSec;
  }

  public void setAmRmHeartbeatIntervalSec(Integer amRmHeartbeatIntervalSec) {
    this.amRmHeartbeatIntervalSec = amRmHeartbeatIntervalSec;
  }

  public Integer getAmRmResyncFrequency() {
    return amRmResyncFrequency;
  }

  public void setAmRmResyncFrequency(Integer amRmResyncFrequency) {
    this.amRmResyncFrequency = amRmResyncFrequency;
  }

  public Integer getAmRmResyncNmExpiryBufferSec() {
    return amRmResyncNmExpiryBufferSec;
  }

  public void setAmRmResyncNmExpiryBufferSec(Integer amRmResyncNmExpiryBufferSec) {
    this.amRmResyncNmExpiryBufferSec = amRmResyncNmExpiryBufferSec;
  }

  public Integer getAmRequestPullIntervalSec() {
    return amRequestPullIntervalSec;
  }

  public void setAmRequestPullIntervalSec(Integer amRequestPullIntervalSec) {
    this.amRequestPullIntervalSec = amRequestPullIntervalSec;
  }

  public Integer getAmStatusPushIntervalSec() {
    return amStatusPushIntervalSec;
  }

  public void setAmStatusPushIntervalSec(Integer amStatusPushIntervalSec) {
    this.amStatusPushIntervalSec = amStatusPushIntervalSec;
  }

  public Integer getAmFrameworkInfoPublishIntervalSec() {
    return amFrameworkInfoPublishIntervalSec;
  }

  public void setAmFrameworkInfoPublishIntervalSec(Integer amFrameworkInfoPublishIntervalSec) {
    this.amFrameworkInfoPublishIntervalSec = amFrameworkInfoPublishIntervalSec;
  }

  public Integer getAmContainerRequestMinTimeoutSec() {
    return amContainerRequestMinTimeoutSec;
  }

  public void setAmContainerRequestMinTimeoutSec(Integer amContainerRequestMinTimeoutSec) {
    this.amContainerRequestMinTimeoutSec = amContainerRequestMinTimeoutSec;
  }

  public Integer getAmContainerRequestMaxTimeoutSec() {
    return amContainerRequestMaxTimeoutSec;
  }

  public void setAmContainerRequestMaxTimeoutSec(Integer amContainerRequestMaxTimeoutSec) {
    this.amContainerRequestMaxTimeoutSec = amContainerRequestMaxTimeoutSec;
  }

  public Integer getAmSetupContainerRequestMinRetryIntervalSec() {
    return amSetupContainerRequestMinRetryIntervalSec;
  }

  public void setAmSetupContainerRequestMinRetryIntervalSec(Integer amSetupContainerRequestMinRetryIntervalSec) {
    this.amSetupContainerRequestMinRetryIntervalSec = amSetupContainerRequestMinRetryIntervalSec;
  }

  public Integer getAmSetupContainerRequestMaxRetryIntervalSec() {
    return amSetupContainerRequestMaxRetryIntervalSec;
  }

  public void setAmSetupContainerRequestMaxRetryIntervalSec(Integer amSetupContainerRequestMaxRetryIntervalSec) {
    this.amSetupContainerRequestMaxRetryIntervalSec = amSetupContainerRequestMaxRetryIntervalSec;
  }

  public Integer getAmGangAllocationTimeoutSec() {
    return amGangAllocationTimeoutSec;
  }

  public void setAmGangAllocationTimeoutSec(Integer amGangAllocationTimeoutSec) {
    this.amGangAllocationTimeoutSec = amGangAllocationTimeoutSec;
  }

  public Integer getAmContainerMinPort() {
    return amContainerMinPort;
  }

  public void setAmContainerMinPort(Integer amContainerMinPort) {
    this.amContainerMinPort = amContainerMinPort;
  }

  public Integer getAmCandidateNodesFactor() {
    return amCandidateNodesFactor;
  }

  public void setAmCandidateNodesFactor(Integer amCandidateNodesFactor) {
    this.amCandidateNodesFactor = amCandidateNodesFactor;
  }

  public Boolean getAmAllowNoneGpuJobOnGpuNode() {
    return amAllowNoneGpuJobOnGpuNode;
  }

  public void setAmAllowNoneGpuJobOnGpuNode(Boolean amAllowNoneGpuJobOnGpuNode) {
    this.amAllowNoneGpuJobOnGpuNode = amAllowNoneGpuJobOnGpuNode;
  }

  public String getWebServerBindHost() {
    return webServerBindHost;
  }

  public void setWebServerBindHost(String webServerBindHost) {
    this.webServerBindHost = webServerBindHost;
  }

  public String getWebServerAddress() {
    return webServerAddress;
  }

  public void setWebServerAddress(String webServerAddress) {
    this.webServerAddress = webServerAddress;
  }

  public Integer getWebServerStatusPullIntervalSec() {
    return webServerStatusPullIntervalSec;
  }

  public void setWebServerStatusPullIntervalSec(Integer webServerStatusPullIntervalSec) {
    this.webServerStatusPullIntervalSec = webServerStatusPullIntervalSec;
  }

  public Boolean getWebServerAclEnable() {
    return webServerAclEnable;
  }

  public void setWebServerAclEnable(Boolean webServerAclEnable) {
    this.webServerAclEnable = webServerAclEnable;
  }

  public Boolean getWebServerAclIgnoreWithoutNamespace() {
    return webServerAclIgnoreWithoutNamespace;
  }

  public void setWebServerAclIgnoreWithoutNamespace(Boolean webServerAclIgnoreWithoutNamespace) {
    this.webServerAclIgnoreWithoutNamespace = webServerAclIgnoreWithoutNamespace;
  }
}
