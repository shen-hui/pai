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

package com.microsoft.frameworklauncher.webserver;

import com.microsoft.frameworklauncher.common.model.LauncherConfiguration;
import org.apache.hadoop.yarn.webapp.WebApp;

public class LauncherWebApp extends WebApp {
  private final LauncherConfiguration conf;
  private final StatusManager statusManager;
  private final RequestManager requestManager;

  public LauncherWebApp(LauncherConfiguration conf, StatusManager statusManager, RequestManager requestManager) {
    this.conf = conf;
    this.statusManager = statusManager;
    this.requestManager = requestManager;
  }

  @Override
  public void setup() {
    bind(JacksonObjectMapperProvider.class);
    bind(LauncherExceptionHandler.class);
    bind(LauncherModule.class);
    bind(LauncherConfiguration.class).toInstance(conf);
    bind(StatusManager.class).toInstance(statusManager);
    bind(RequestManager.class).toInstance(requestManager);
  }
}
