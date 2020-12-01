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

import java.io.Serializable;

public class LauncherStatus implements Serializable {
  private LauncherConfiguration launcherConfiguration;
  private UserContainerExitSpec userContainerExitSpec;
  private UserDescriptor loggedInUser;
  private Boolean hadoopLibrarySupportsGpu;
  private Boolean hadoopLibrarySupportsPort;
  private String serviceHost;
  private String serviceIp;

  public LauncherConfiguration getLauncherConfiguration() {
    return launcherConfiguration;
  }

  public void setLauncherConfiguration(LauncherConfiguration launcherConfiguration) {
    this.launcherConfiguration = launcherConfiguration;
  }

  public UserContainerExitSpec getUserContainerExitSpec() {
    return userContainerExitSpec;
  }

  public void setUserContainerExitSpec(UserContainerExitSpec userContainerExitSpec) {
    this.userContainerExitSpec = userContainerExitSpec;
  }

  public UserDescriptor getLoggedInUser() {
    return loggedInUser;
  }

  public void setLoggedInUser(UserDescriptor loggedInUser) {
    this.loggedInUser = loggedInUser;
  }

  public Boolean getHadoopLibrarySupportsGpu() {
    return hadoopLibrarySupportsGpu;
  }

  public void setHadoopLibrarySupportsGpu(Boolean hadoopLibrarySupportsGpu) {
    this.hadoopLibrarySupportsGpu = hadoopLibrarySupportsGpu;
  }

  public Boolean getHadoopLibrarySupportsPort() {
    return hadoopLibrarySupportsPort;
  }

  public void setHadoopLibrarySupportsPort(Boolean hadoopLibrarySupportsPort) {
    this.hadoopLibrarySupportsPort = hadoopLibrarySupportsPort;
  }

  public String getServiceHost() {
    return serviceHost;
  }

  public void setServiceHost(String serviceHost) {
    this.serviceHost = serviceHost;
  }

  public String getServiceIp() {
    return serviceIp;
  }

  public void setServiceIp(String serviceIp) {
    this.serviceIp = serviceIp;
  }
}
