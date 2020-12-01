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

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import java.io.Serializable;

// Computation Platform Specific Parameters for specific TaskRole
// The field here will override the corresponding field inside
// FrameworkDescriptor.PlatformSpecificParametersDescriptor if it is not null.
public class TaskRolePlatformSpecificParametersDescriptor implements Serializable {
  @Valid
  private String taskNodeLabel;

  @Valid
  @Pattern(regexp = "^[^\\s]{1,256}$")
  private String taskNodeGpuType;

  @Valid
  @NotNull
  // If this feature is enabled, different Tasks is ensured to allocate the same ports
  // even if dynamic port range is specified in portDefinitions.
  @Deprecated
  private Boolean samePortAllocation = false;

  public String getTaskNodeLabel() {
    return taskNodeLabel;
  }

  public void setTaskNodeLabel(String taskNodeLabel) {
    this.taskNodeLabel = taskNodeLabel;
  }

  public String getTaskNodeGpuType() {
    return taskNodeGpuType;
  }

  public void setTaskNodeGpuType(String taskNodeGpuType) {
    this.taskNodeGpuType = taskNodeGpuType;
  }

  public Boolean getSamePortAllocation() {
    return samePortAllocation;
  }

  public void setSamePortAllocation(Boolean samePortAllocation) {
    this.samePortAllocation = samePortAllocation;
  }
}
