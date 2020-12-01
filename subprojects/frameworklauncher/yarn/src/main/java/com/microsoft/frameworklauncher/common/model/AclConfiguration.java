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

import com.microsoft.frameworklauncher.common.validation.MapKeyNamingValidation;
import com.microsoft.frameworklauncher.common.validation.MapValueNotNullValidation;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.io.Serializable;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class AclConfiguration implements Serializable {
  @Valid
  @NotNull
  @MapKeyNamingValidation
  @MapValueNotNullValidation
  // Namespace -> AccessControlList
  // Namespace can be UserName, GroupName, etc.
  private Map<String, AccessControlList> namespaceAcls = new HashMap<>();

  @Valid
  @NotNull
  private Set<UserDescriptor> normalAdminUsers = new HashSet<>();

  public Map<String, AccessControlList> getNamespaceAcls() {
    return namespaceAcls;
  }

  public void setNamespaceAcls(Map<String, AccessControlList> namespaceAcls) {
    this.namespaceAcls = namespaceAcls;
  }

  public Set<UserDescriptor> getNormalAdminUsers() {
    return normalAdminUsers;
  }

  public void setNormalAdminUsers(Set<UserDescriptor> normalAdminUsers) {
    this.normalAdminUsers = normalAdminUsers;
  }
}
