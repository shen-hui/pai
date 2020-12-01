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

# clean all the data in the cluster.



cp /${DELETE_CONFIG}/${WORKER_CONFIG}  delete_worker.sh
chmod u+x delete_worker.sh

./delete_worker.sh

# Because Kuberetnes can't run the job to every node such as daemonset.
# So we will use readiness probes to judge whether the batch job finish or not.
# And then with the help of loop, we will prevent the pod to restart.
# After the /jobstatus/jobok is touched, we will find the status of pod is ready with kubectl.
# If all pod is ready, the "daemon job" is finished. We can run kubectl delete to delete all the pod.
mkdir -p /jobstatus
touch /jobstatus/jobok

while true; do sleep 1000; done
