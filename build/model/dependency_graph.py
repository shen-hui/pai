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

from __future__ import absolute_import
from __future__ import print_function

from core import build_utility

import os
import sys
import datetime
import logging
import logging.config

class ServiceNode(object):

    def __init__(self, path, service_name):
        self.path = path
        self.service_name = service_name
        self.docker_files = list()
        self.inedges = list()
        self.outedges = list()

        self.logger = logging.getLogger(__name__)
        build_utility.setup_logger_config(self.logger)


    def dump(self):
        self.logger.info("Path:{} Name:{} Inedge:{} Outedge:{}".format(
            self.path,
            self.service_name,
            self.inedges,
            self.outedges
        ))


class ServiceGraph(object):

    logger = logging.getLogger(__name__)
    build_utility.setup_logger_config(logger)

    def __init__(self):
        self.services = dict()
        self.image_to_service = dict()

    def add_service(self, path, service_name):
        if not service_name in self.services:
            self.services[service_name] = ServiceNode(path, service_name)


    def add_image_to_service(self, image_docker_file_prefix, service_name):
        image_name = os.path.splitext(image_docker_file_prefix)[0]
        if image_name in self.image_to_service:
            self.logger.error("Same image name:{0} detected! Please check!".format(image_name))
            self.logger.error("Duplication image belongs to service:{0} and service:{1}".format(service_name, self.image_to_service[image_name]))
            sys.exit(1)
        self.image_to_service[image_name] = service_name
        self.services[service_name].docker_files.append(image_docker_file_prefix)


    def add_dependency(self, prev_service, succ_service):
        if not prev_service:
            return
        if prev_service in self.services and succ_service in self.services:
            self.services[prev_service].outedges.append(succ_service)
            self.services[succ_service].inedges.append(prev_service)
        else:
            self.logger.error("Invalid dependency found: {0} in {1}".format(prev_service,succ_service))
            sys.exit(1)

    def topology(self):
        prev_count = dict()
        ret = list()
        search_queue = list()
        for name, node in self.services.items():
            prev_count[name] = len(node.inedges)
            if prev_count[name] == 0:
                search_queue.append(name)

        while search_queue:
            current_node = search_queue[0]
            search_queue.pop(0)
            ret.append(current_node)
            for succ_service in self.services[current_node].outedges:
                prev_count[succ_service] -= 1
                if prev_count[succ_service] == 0:
                    search_queue.append(succ_service)

        # Add dependency loop check
        if not len(self.services) == len(ret):
            self.logger.error("Dependency loop detected! Please check!")
            sys.exit(1)

        return ret


    def dump(self):
        for _, service in self.services.items():
            service.dump()


    def extract_sub_graph(self, dest_nodes):
        if not dest_nodes:
            return None
        search_queue = dest_nodes
        ret = search_queue[:]
        while search_queue:
            current_node = search_queue[0]
            search_queue.pop(0)
            for prev_service in self.services[current_node].inedges:
                if not prev_service in ret:
                    ret.append(prev_service)
                    search_queue.append(prev_service)
        return ret
