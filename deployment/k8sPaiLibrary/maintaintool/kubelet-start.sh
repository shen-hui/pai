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

set -e

scriptPath=$1


#stop all swap on the machine

swapoff -a

# check etc/ exist or not.
staticpod="$scriptPath/etc"
if [ -d "$staticpod" ]; then

    cp -r $scriptPath/etc /

fi

manifestpath="/etc/kubernetes/manifests"
if [ ! -d "$manifestpath" ]; then

    mkdir -p $manifestpath

fi


cp $scriptPath/kubelet.sh /usr/bin/openpai-kubelet.sh
chmod u+x /usr/bin/openpai-kubelet.sh

cp $scriptPath/kubelet.service /etc/systemd/system/
chmod 664 /etc/systemd/system/kubelet.service

systemctl daemon-reload
systemctl enable kubelet
systemctl start kubelet
