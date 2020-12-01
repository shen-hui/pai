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

sed -i '/^ZOO_LOG4J_PROP/ s:.*:ZOO_LOG4J_PROP="INFO,CONSOLE":' /usr/local/zookeeper/bin/zkEnv.sh
sed -i "/^JAVA_OPTS.*/ s:.*:JVMFLAGS=\"${JAVA_OPTS}\":" /usr/local/zookeeper/bin/zkEnv.sh

mkdir -p /etc/zookeeper/conf/
mkdir -p /var/lib/zoodata/
cp /zk-configuration/myid /var/lib/zoodata/myid
cp /zk-configuration/zoo.cfg /usr/local/zookeeper/conf/zoo.cfg


HOST_NAME=`hostname`
/usr/local/host-configure.py -c /host-configuration/host-configuration.yaml -f /usr/local/zookeeper/conf/zoo.cfg -n $HOST_NAME
/usr/local/host-configure.py -c /host-configuration/host-configuration.yaml -f /var/lib/zoodata/myid -n $HOST_NAME

mkdir -p /jobstatus
touch /jobstatus/jobok

zkServer.sh start-foreground

