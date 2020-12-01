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
import {
  Link,
  PrimaryButton,
  DefaultButton,
  Stack,
  getTheme,
  FontClassNames,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
} from 'office-ui-fabric-react';
import PropTypes from 'prop-types';
import React from 'react';

import {
  getJobDuration,
  getDurationString,
  getJobModifiedTimeString,
  getHumanizedJobStateString,
  getJobModifiedTime,
} from '../../components/util/job';

import t from '../../components/tachyons.scss';
import StatusBadge from '../../components/status-badge';

const DummyContent = () => {
  const { spacing } = getTheme();
  return (
    <div className={c(t.mv3, t.h100, t.flex, t.itemsCenter, t.justifyCenter)}>
      <div
        className={c(t.overflowAuto, t.w100)}
        style={{ maxHeight: '100%', padding: spacing.m }}
      >
        <div className={c(t.tc, FontClassNames.large)}>
          没有最新任务可显示
        </div>
        <div
          className={c(t.tc, FontClassNames.large)}
          style={{ marginTop: spacing.l2 }}
        >
          {`当您访问任务时，这些任务将列在最近使用的任务中，以便快速方便地访问.`}
        </div>
        <Stack
          styles={{ root: [{ marginTop: spacing.l3 }] }}
          horizontal
          horizontalAlign='center'
          gap='s1'
        >
          <Stack.Item>
            <PrimaryButton
              styles={{ root: [{ width: 120 }] }}
              text='Create a job'
              href='submit.html'
            />
          </Stack.Item>
          <Stack.Item>
            <DefaultButton
              text='Tutorial'
              styles={{ root: [{ width: 120 }] }}
              href='https://openpai.readthedocs.io/zh_CN/latest/manual/cluster-user/quick-start.html'
              target='_blank'
            />
          </Stack.Item>
        </Stack>
      </div>
    </div>
  );
};

const jobListColumns = [
  {
    key: 'name',
    minWidth: 200,
    name: '任务名称',
    fieldName: 'name',
    className: FontClassNames.mediumPlus,
    isResizable: true,
    onRender(job) {
      const { legacy, name, namespace, username } = job;
      const href = legacy
        ? `/job-detail.html?jobName=${name}`
        : `/job-detail.html?username=${namespace || username}&jobName=${name}`;
      return <Link href={href}>{name}</Link>;
    },
  },
  {
    key: 'modified',
    minWidth: 150,
    name: '修改日期',
    className: FontClassNames.mediumPlus,
    isResizable: true,
    onRender(job) {
      return getJobModifiedTimeString(job);
    },
  },
  {
    key: 'duration',
    minWidth: 120,
    name: '持续时间',
    className: FontClassNames.mediumPlus,
    isResizable: true,
    onRender(job) {
      return getDurationString(getJobDuration(job));
    },
  },
  {
    key: 'virtualCluster',
    minWidth: 100,
    name: '虚拟集群',
    fieldName: 'virtualCluster',
    className: FontClassNames.mediumPlus,
    isResizable: true,
  },
  {
    key: 'status',
    minWidth: 100,
    name: '任务状态',
    isResizable: true,
    onRender(job) {
      return <StatusBadge status={getHumanizedJobStateString(job)} />;
    },
  },
];

const Content = ({ jobs }) => {
  if (true && isEmpty(jobs)) {
    return <DummyContent />;
  } else {
    const items = jobs
      .slice()
      .sort((a, b) => getJobModifiedTime(b) - getJobModifiedTime(a))
      .slice(0, 10);
    return (
      <div className={c(t.mv3, t.ph5, t.h100, t.overflowYAuto)}>
        <DetailsList
          columns={jobListColumns}
          disableSelectionZone
          items={items}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
        />
      </div>
    );
  }
};

const RecentJobList = ({ style, jobs }) => {
  return <Content jobs={jobs} />;
};

RecentJobList.propTypes = {
  style: PropTypes.object,
  jobs: PropTypes.array.isRequired,
};

export default RecentJobList;
