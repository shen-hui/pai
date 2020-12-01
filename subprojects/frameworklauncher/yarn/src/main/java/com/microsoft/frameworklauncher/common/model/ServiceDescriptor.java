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

import com.microsoft.frameworklauncher.common.validation.GpuValidation;
import com.microsoft.frameworklauncher.common.validation.PortValidation;
import org.hibernate.validator.constraints.NotEmpty;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.io.Serializable;
import java.util.List;

public class ServiceDescriptor implements Serializable {
  @Valid
  @NotNull
  // version change will trigger the Service Rolling Upgrade
  private Integer version;

  @Valid
  @NotEmpty
  private String entryPoint;

  @Valid
  @NotEmpty
  // Currently only HDFS URI is supported
  private List<String> sourceLocations;

  @Valid
  @NotNull
  @GpuValidation
  @PortValidation
  private ResourceDescriptor resource;

  // private RetryPolicyDescriptor retryPolicy;
  // private vector<string> dependOnServices;

  public Integer getVersion() {
    return version;
  }

  public void setVersion(Integer version) {
    this.version = version;
  }

  public String getEntryPoint() {
    return entryPoint;
  }

  public void setEntryPoint(String entryPoint) {
    this.entryPoint = entryPoint;
  }

  public List<String> getSourceLocations() {
    return sourceLocations;
  }

  public void setSourceLocations(List<String> sourceLocations) {
    this.sourceLocations = sourceLocations;
  }

  public ResourceDescriptor getResource() {
    return resource;
  }

  public void setResource(ResourceDescriptor resource) {
    this.resource = resource;
  }
}
