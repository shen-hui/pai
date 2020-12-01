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

echo "Call stop to stop all dshuttle-worker pod first"
/bin/bash stop.sh || exit $?

echo "Create dshuttle-wroker-delete configmap for deleting data on the host"
kubectl create configmap dshuttle-worker-delete --from-file=dshuttle-worker-delete/ --dry-run -o yaml | kubectl apply --overwrite=true -f - || exit $?

echo "Create cleaner daemon"
kubectl apply --overwrite=true -f delete.yaml || exit $?
sleep 5

PYTHONPATH="../../../deployment" python -m  k8sPaiLibrary.monitorTool.check_pod_ready_status -w -k app -v delete-batch-job-dshuttle-worker || exit $?

echo "Dshuttle worker clean job is done"
echo "Delete dshuttle worker cleaner daemon and configmap"
if kubectl get daemonset | grep -q "delete-batch-job-dshuttle-worker"; then
    kubectl delete ds delete-batch-job-dshuttle-worker || exit $?
fi

if kubectl get configmap | grep -q "dshuttle-worker-delete"; then
    kubectl delete configmap dshuttle-worker-delete || exit $?
fi
sleep 5

popd > /dev/null