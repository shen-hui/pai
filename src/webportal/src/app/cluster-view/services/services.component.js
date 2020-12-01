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

// module dependencies
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch';
import { getServiceView } from './service-info';

const breadcrumbComponent = require('../../job/breadcrumb/breadcrumb.component.ejs');
const loadingComponent = require('../../job/loading/loading.component.ejs');
const serviceTableComponent = require('./service-table.component.ejs');
const serviceViewComponent = require('./services.component.ejs');
const loading = require('../../job/loading/loading.component');
const webportalConfig = require('../../config/webportal.config.js');
require('bootstrap');
require('admin-lte/dist/css/AdminLTE.min.css');
require('bootstrap/dist/css/bootstrap.css');
require('datatables.net/js/jquery.dataTables.js');
require('datatables.net-bs/js/dataTables.bootstrap.js');
require('datatables.net-bs/css/dataTables.bootstrap.css');
require('datatables.net-plugins/sorting/natural.js');
require('datatables.net-plugins/sorting/ip-address.js');
require('datatables.net-plugins/sorting/title-numeric.js');
require('./service-view.component.scss');

const serviceViewHtml = serviceViewComponent({
  breadcrumb: breadcrumbComponent,
  loading: loadingComponent,
  serviceTable: serviceTableComponent,
});

const loadServices = () => {
  loading.showLoading();
  getServiceView(data => {
    loading.hideLoading();
    $('#service-table').html(
      serviceTableComponent({
        data,
        k8sUri: webportalConfig.k8sDashboardUri,
        grafanaUri: webportalConfig.grafanaUri,
        exporterPort: webportalConfig.exporterPort,
      }),
    );
    $('#service-datatable')
      .dataTable({
        scrollY: $(window).height() - 265 + 'px',
        lengthMenu: [[20, 50, 100, -1], [20, 50, 100, 'All']],
        columnDefs: [
          { orderDataType: 'dom-text', targets: [1, 2] },
          { type: 'ip-address', targets: [0] },
        ],
        language: {
          lengthMenu:
            '<select class="form-control input-xsmall">' +
            '<option value="20">20</option>' +
            '<option value="50">50</option>' +
            '<option value="100">100</option>' +
            '<option value="-1">All</option>' +
            '</select>条记录',
          search: '<span>搜索：</span>',
          paginate: {
            previous: '上一页',
            next: '下一页',
            first: '第一页',
            last: '最后',
          },
          zeroRecords: '没有内容',
          info: '总共_PAGES_ 页，显示第_START_ 页',
          infoEmpty: '0条记录',
          infoFiltered: '',
        },
      })
      .api();
  });
};

window.loadServices = loadServices;

$('#content-wrapper').html(serviceViewHtml);
$(document).ready(() => {
  loadServices();
});
