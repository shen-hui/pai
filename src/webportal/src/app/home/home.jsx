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

import c from 'classnames';
import { isEmpty } from 'lodash';
import { Stack, StackItem, Pivot, PivotItem } from 'office-ui-fabric-react';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import MediaQuery from 'react-responsive';

import Card from '../components/card';
import JobStatus from './home/job-status';
import { VirtualClusterStatistics } from './home/virtual-cluster-statistics';
import GpuChart from './home/gpu-chart';
import {
  listJobs,
  getUserInfo,
  listVirtualClusters,
  getAvailableGpuPerNode,
  UnauthorizedError,
  getLowGpuJobInfos,
  listAllJobs,
  getJobStatusNumber,
} from './home/conn';
import { listAbnormalJobs } from '../components/util/job';
import RecentJobList from './home/recent-job-list';
import AbnormalJobList from './home/abnormal-job-list';
import { BREAKPOINT1 } from './home/util';
import { SpinnerLoading } from '../components/loading';
import { clearToken } from '../user/user-logout/user-logout.component.js';
import { TooltipIcon } from '../job-submission/components/controls/tooltip-icon';

import t from '../components/tachyons.scss';

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [jobStatusNumber, setJobStatusNumber] = useState(null);
  const [runningJobs, setRunningJobs] = useState(null);
  const [userJobs, setUserJobs] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [virtualClusters, setVirtualClusters] = useState(null);
  const [gpuPerNode, setGpuPerNode] = useState(null);
  const [lowGpuJobInfo, setLowGpuJobInfo] = useState(null);
  const isAdmin = cookies.get('admin') === 'true';

  useEffect(() => {
    if (!isEmpty(cookies.get('user'))) {
      if (isAdmin) {
        getLowGpuJobInfos()
          .then(setLowGpuJobInfo)
          .catch(alert);
      }
      Promise.all([
        getJobStatusNumber(isAdmin).then(setJobStatusNumber),
        listJobs({ limit: 100 }).then(setUserJobs),
        listAllJobs({ state: 'RUNNING' }).then(setRunningJobs),
        getUserInfo().then(setUserInfo),
        listVirtualClusters().then(setVirtualClusters),
        getAvailableGpuPerNode().then(setGpuPerNode),
      ])
        .then(() => {
          setLoading(false);
        })
        .catch(err => {
          if (err instanceof UnauthorizedError) {
            alert(err);
            clearToken();
          } else {
            alert(err);
          }
        });
    } else {
      // layout.component.js will redirect user to index page.
    }
  }, []);

  if (loading) {
    return <SpinnerLoading />;
  } else {
    return (
      <div className={c(t.w100)} style={{ minWidth: 375, overflowY: 'auto' }}>
        {/* small */}
        <MediaQuery maxWidth={BREAKPOINT1}>
          <Stack padding='l2' gap='l1' styles={{ minHeight: '100%' }}>
            <JobStatus
              style={{ height: 320 }}
              jobStatusNumber={jobStatusNumber}
            />
            <React.Fragment>
              <VirtualClusterStatistics
                style={{ height: 320 }}
                userInfo={userInfo}
                virtualClusters={virtualClusters}
              />
              <GpuChart
                style={{ height: 320 }}
                gpuPerNode={gpuPerNode}
                userInfo={userInfo}
                virtualClusters={virtualClusters}
              />
            </React.Fragment>
            <Card>
              {isAdmin ? (
                <Pivot styles={{ root: { maxHeight: '100%' } }}>
                  <PivotItem
                    headerText='异常任务'
                    onRenderItemLink={(link, defaultRenderer) => {
                      return (
                        <Stack horizontal gap='s1'>
                          {defaultRenderer(link)}
                        </Stack>
                      );
                    }}
                  >
                    <AbnormalJobList
                      jobs={listAbnormalJobs(runningJobs, lowGpuJobInfo)}
                    />
                  </PivotItem>
                  <PivotItem headerText='最新任务'>
                    <RecentJobList style={{ minHeight: 0 }} jobs={userJobs} />
                  </PivotItem>
                </Pivot>
              ) : (
                <Pivot>
                  <PivotItem headerText='最新任务'>
                    <RecentJobList style={{ minHeight: 0 }} jobs={userJobs} />
                  </PivotItem>
                </Pivot>
              )}
            </Card>
          </Stack>
        </MediaQuery>
        {/* large */}
        <MediaQuery minWidth={BREAKPOINT1 + 1}>
          <Stack padding='l2' gap='l1' styles={{ root: { height: '100%' } }}>
            {/* top */}
            <StackItem disableShrink>
              <Stack gap='l1' horizontal>
                <React.Fragment>
                  <JobStatus
                    style={{ width: '33%' }}
                    jobStatusNumber={jobStatusNumber}
                  />
                  <VirtualClusterStatistics
                    style={{ width: '33%' }}
                    userInfo={userInfo}
                    virtualClusters={virtualClusters}
                  />
                  <GpuChart
                    style={{ width: '34%' }}
                    gpuPerNode={gpuPerNode}
                    userInfo={userInfo}
                    virtualClusters={virtualClusters}
                  />
                </React.Fragment>
              </Stack>
            </StackItem>
            {/* bottom */}
            <Card style={{ minHeight: 600 }}>
              {isAdmin ? (
                <Stack horizontal>
                  <TooltipIcon
                    content={
                      'https://openpai.readthedocs.io/zh_CN/latest/manual/cluster-admin/basic-management-operations.html#abnormal-jobs'
                    }
                  />
                  <Pivot>
                    <PivotItem headerText='异常任务'>
                      <AbnormalJobList
                        jobs={listAbnormalJobs(runningJobs, lowGpuJobInfo)}
                      />
                    </PivotItem>
                    <PivotItem headerText='最新任务'>
                      <RecentJobList style={{ minHeight: 0 }} jobs={userJobs} />
                    </PivotItem>
                  </Pivot>
                </Stack>
              ) : (
                <Pivot>
                  <PivotItem headerText='最新任务'>
                    <RecentJobList style={{ minHeight: 0 }} jobs={userJobs} />
                  </PivotItem>
                </Pivot>
              )}
            </Card>
          </Stack>
        </MediaQuery>
      </div>
    );
  }
};

const contentWrapper = document.getElementById('content-wrapper');

ReactDOM.render(<Home />, contentWrapper);
