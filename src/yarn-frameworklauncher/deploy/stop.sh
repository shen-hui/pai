#!/bin/bash

# Copyright (c) Microsoft Corporation
# All rights reserved.
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
# documentation files (the "Software"), to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
# to permit persons to whom the Software is furnished to do so, subject to the following conditions:
# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
# BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
# DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

pushd $(dirname "$0") > /dev/null

if kubectl get daemonset | grep -q "yarn-frameworklauncher-ds"; then
    kubectl delete ds yarn-frameworklauncher-ds || exit $?
fi

if kubectl get configmap | grep -q "yarn-frameworklauncher-configmap"; then
    kubectl delete configmap yarn-frameworklauncher-configmap || exit $?
fi

# Also check frameworklauncher-ds for backward compatibility
if kubectl get daemonset | grep -q "frameworklauncher-ds"; then
    kubectl delete ds frameworklauncher-ds || exit $?
fi

if kubectl get configmap | grep -q "frameworklauncher-configmap"; then
    kubectl delete configmap frameworklauncher-configmap || exit $?
fi


popd > /dev/null