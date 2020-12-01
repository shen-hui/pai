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

import org.apache.hadoop.yarn.api.records.Container;
import org.apache.hadoop.yarn.api.records.ContainerId;
import org.apache.hadoop.yarn.api.records.ContainerLaunchContext;
import org.apache.hadoop.yarn.api.records.NodeId;
import org.apache.hadoop.yarn.client.api.async.NMClientAsync;

public class MockNMClient extends NMClientAsync {

  public MockNMClient(AbstractCallbackHandler callbackHandler) {
    super(MockNMClient.class.getName(), callbackHandler);
  }

  @Override
  public void startContainerAsync(Container container, ContainerLaunchContext containerLaunchContext) {

  }

  @Override
  public void stopContainerAsync(ContainerId containerId, NodeId nodeId) {

  }

  @Override
  public void getContainerStatusAsync(ContainerId containerId, NodeId nodeId) {

  }

  @Override
  public void updateContainerResourceAsync(Container container) {

  }

  @Override
  public void commitLastReInitializationAsync(ContainerId containerId) {

  }

  @Override
  public void increaseContainerResourceAsync(Container container) {

  }

  @Override
  public void reInitializeContainerAsync(ContainerId containerId,
      ContainerLaunchContext containerLaunchContex, boolean autoCommit) {

  }

  @Override
  public void restartContainerAsync(ContainerId containerId) {

  }

  @Override
  public void rollbackLastReInitializationAsync(ContainerId containerId) {

  }
}
