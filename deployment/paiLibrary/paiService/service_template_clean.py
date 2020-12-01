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

import os
import logging
import logging.config

from ..common import file_handler

package_directory_serv_template_clear = os.path.dirname(os.path.abspath(__file__))


class service_template_clean:


    def __init__(self, service_name, service_conf):

        self.logger = logging.getLogger(__name__)

        self.service_name = service_name
        self.service_conf = service_conf

        self.template_list = None
        if "template-list" in self.service_conf:
            self.template_list = self.service_conf["template-list"]

        self.src_path = "{0}/../../../src".format(package_directory_serv_template_clear)



    def template_cleaner(self):

        self.logger.info("Begin to delete the generated template of {0}'s service.".format(self.service_name))

        if self.template_list is None:
            self.logger.info("There is no generated template of {0}'s service to be deleted.".format(self.service_name))
            return

        for template_file in self.template_list:
            file_path = "{0}/{1}/deploy/{2}".format(self.src_path, self.service_name, template_file)
            if file_handler.file_exist_or_not(file_path) == True:
                file_handler.file_delete(file_path)

        self.logger.info("The generated template files of {0}'s  service have been cleaned up.".format(self.service_name))



    def run(self):

        self.template_cleaner()