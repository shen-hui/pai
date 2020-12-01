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
import com.microsoft.frameworklauncher.common.log.DefaultLogger;
import com.microsoft.frameworklauncher.common.model.FrameworkState;
import com.microsoft.frameworklauncher.common.model.FrameworkStatus;
import com.microsoft.frameworklauncher.common.model.LauncherConfiguration;
import com.microsoft.frameworklauncher.common.utils.CommonUtils;
import org.apache.hadoop.yarn.api.records.ApplicationId;
import org.apache.hadoop.yarn.api.records.ApplicationReport;
import org.apache.hadoop.yarn.api.records.FinalApplicationStatus;
import org.apache.hadoop.yarn.api.records.YarnApplicationState;
import org.apache.hadoop.yarn.client.api.YarnClient;

import java.util.*;

public class RMResyncHandler { // THREAD SAFE
  private static final DefaultLogger LOGGER = new DefaultLogger(RMResyncHandler.class);

  private final Service service;
  private final LauncherConfiguration conf;
  private final YarnClient yarnClient;
  private final StatusManager statusManager;

  public RMResyncHandler(
      Service service, LauncherConfiguration conf,
      YarnClient yarnClient, StatusManager statusManager) {
    this.service = service;
    this.conf = conf;
    this.yarnClient = yarnClient;
    this.statusManager = statusManager;
  }

  public void start() {
    LOGGER.logInfo("Starting RMResyncHandler");

    // The order is important between executing resyncWithRM and other SystemTasks,
    // so resyncWithRM is also need to be queued to execute.
    service.queueResyncWithRM(conf.getServiceRMResyncIntervalSec());

    LOGGER.logInfo("Running RMResyncHandler");
  }

  public void resyncWithRM() throws Exception {
    List<ApplicationReport> applicationReports = null;

    try {
      LOGGER.logDebug("Started to getApplications");

      // Only Get LAUNCHER ApplicationReport
      applicationReports = yarnClient.getApplications(new HashSet<>(
          Collections.singletonList(GlobalConstants.LAUNCHER_APPLICATION_TYPE)));

      LOGGER.logDebug("Succeeded to getApplications");
    } catch (Exception e) {
      LOGGER.logWarning(e,
          "Exception occurred during getApplications. It should be transient. " +
              "Will retry next time after %ss", conf.getServiceRMResyncIntervalSec());
    }

    if (applicationReports != null) {
      // ApplicationId -> ApplicationReport
      Map<String, ApplicationReport> liveApplicationReports = new HashMap<>();
      for (ApplicationReport applicationReport : applicationReports) {
        liveApplicationReports.put(
            applicationReport.getApplicationId().toString(), applicationReport);
      }


      // GetApplications only leverages RM, so the result may be incomplete due to the application
      // is finished and then GCed in RM. So, we need to also leverage ApplicationHistoryServer
      // by using getApplicationReport to supplement the result.
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

          String supplementLogPrefix = String.format(
              "[%s][%s]: Supplement liveApplicationReports. Reason: ",
              frameworkName, applicationId);
          String skipToSupplementLogPrefix = String.format(
              "[%s][%s]: Skip to supplement liveApplicationReports. Reason: ",
              frameworkName, applicationId);

          ApplicationReport applicationReport = null;

          try {
            applicationReport = yarnClient.getApplicationReport(ApplicationId.fromString(applicationId));
          } catch (Exception e) {
            // Best Effort to getApplicationReport, since it depends on ApplicationHistoryServer
            // which is not as reliable as RM.
            LOGGER.logWarning(e, skipToSupplementLogPrefix + "Failed to getApplicationReport");
          }

          if (applicationReport != null) {
            YarnApplicationState applicationState = applicationReport.getYarnApplicationState();
            FinalApplicationStatus applicationFinalStatus = applicationReport.getFinalApplicationStatus();
            String diagnostics = CommonUtils.trim(applicationReport.getDiagnostics());
            if (applicationFinalStatus == FinalApplicationStatus.UNDEFINED) {
              LOGGER.logWarning(skipToSupplementLogPrefix +
                      "The applicationReport is not reliable since " +
                      "the Application from getApplicationReport is not completed. " +
                      "ApplicationState: %s, ApplicationFinalStatus: %s, Diagnostics: %s",
                  applicationState, applicationFinalStatus, diagnostics);
            } else {
              LOGGER.logInfo(supplementLogPrefix +
                      "The applicationReport is reliable since " +
                      "the Application from getApplicationReport is completed. " +
                      "ApplicationState: %s, ApplicationFinalStatus: %s, Diagnostics: %s",
                  applicationState, applicationFinalStatus, diagnostics);
              liveApplicationReports.put(applicationId, applicationReport);
            }
          }
        }
      }

      service.onLiveApplicationsUpdated(liveApplicationReports);
    }

    service.queueResyncWithRM(conf.getServiceRMResyncIntervalSec());
  }
}