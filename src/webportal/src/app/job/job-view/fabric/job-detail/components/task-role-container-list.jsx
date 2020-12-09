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

import { ThemeProvider } from '@uifabric/foundation';
import {
  createTheme,
  ColorClassNames,
  FontClassNames,
  getTheme,
} from '@uifabric/styling';
import c from 'classnames';
import { capitalize, isEmpty, isNil, flatten } from 'lodash';
import { DateTime, Interval } from 'luxon';
import {
  CommandBarButton,
  PrimaryButton,
  TooltipHost,
  Text,
  DirectionalHint,
  Dialog,
  DialogFooter,
  Stack,
  Link,
  Icon,
} from 'office-ui-fabric-react';
import {
  DetailsList,
  SelectionMode,
  DetailsRow,
  DetailsListLayoutMode,
} from 'office-ui-fabric-react/lib/DetailsList';
import PropTypes from 'prop-types';
import React from 'react';
import yaml from 'js-yaml';

import localCss from './task-role-container-list.scss';
import t from '../../../../../components/tachyons.scss';

import Context from './context';
import Timer from './timer';
import { getContainerLog, getContainerLogList } from '../conn';
import config from '../../../../../config/webportal.config';
import MonacoPanel from '../../../../../components/monaco-panel';
import StatusBadge from '../../../../../components/status-badge';
import { getDurationString } from '../../../../../components/util/job';
import CopyButton from '../../../../../components/copy-button';

const params = new URLSearchParams(window.location.search);
const userName = params.get('username');
const jobName = params.get('jobName');

const theme = createTheme({
  palette: {
    themePrimary: '#2C70BA',
    themeLighterAlt: '#eff6fc',
    themeLighter: '#deecf9',
    themeLight: '#c7e0f4',
    themeTertiary: '#71afe5',
    themeSecondary: '#2b88d8',
    themeDarkAlt: '#106ebe',
    themeDark: '#005a9e',
    themeDarker: '#004578',
    neutralLighterAlt: '#f1f1f1',
    neutralLighter: '#ededed',
    neutralLight: '#e3e3e3',
    neutralQuaternaryAlt: '#d3d3d3',
    neutralQuaternary: '#cacaca',
    neutralTertiaryAlt: '#c2c2c2',
    neutralTertiary: '#c2c2c2',
    neutralSecondary: '#858585',
    neutralPrimaryAlt: '#4b4b4b',
    neutralPrimary: '#333333',
    neutralDark: '#272727',
    black: '#1d1d1d',
    white: '#f8f8f8',
  },
});

const interval = 10000;

const IPTooltipContent = ({ ip }) => {
  return (
    <div>
      <Stack horizontal verticalAlign='center'>
        <div>{`Container IP: ${ip}`}</div>
        <div>
          <CopyButton value={ip} />
        </div>
      </Stack>
    </div>
  );
};

IPTooltipContent.propTypes = {
  ip: PropTypes.string,
};

const PortTooltipContent = ({ ports }) => {
  const { spacing } = getTheme();
  return (
    <div>
      <table>
        <tbody>
          {Object.entries(ports).map(([key, val]) => (
            <tr key={`port-${key}`}>
              <td style={{ padding: spacing.s2 }}>{`${key}:`}</td>
              <td style={{ padding: spacing.s2 }}>{val}</td>
              <td>
                <CopyButton value={val} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

PortTooltipContent.propTypes = {
  ports: PropTypes.object,
};

const LogDialogContent = ({ urlLists }) => {
  const lists = [];
  for (const p of urlLists) {
    lists.push(p);
  }
  if (lists.length === 0) {
    return <Stack>No log file generated or log files be rotated</Stack>;
  }
  const urlpairs = lists.map((lists, index) => (
    <Stack key={`log-list-${index}`}>
      <Link
        href={lists.uri}
        target='_blank'
        styles={{ root: [FontClassNames.mediumPlus] }}
      >
        <Icon iconName='TextDocument'></Icon> {lists.name}
      </Link>
    </Stack>
  ));
  return urlpairs;
};

LogDialogContent.propTypes = {
  urlLists: PropTypes.array,
};

export default class TaskRoleContainerList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      monacoProps: null,
      monacoTitle: '',
      monacoFooterButton: null,
      fullLogUrls: {},
      tailLogUrls: {},
      logListUrl: null,
      logType: null,
      items: props.tasks,
      ordering: { field: null, descending: false },
      hideAllLogsDialog: true,
    };

    this.showSshInfo = this.showSshInfo.bind(this);
    this.showAllLogDialog = this.showAllLogDialog.bind(this);
    this.onDismiss = this.onDismiss.bind(this);
    this.convertObjectFormat = this.convertObjectFormat.bind(this);
    this.showContainerTailLog = this.showContainerTailLog.bind(this);
    this.onRenderRow = this.onRenderRow.bind(this);
    this.logAutoRefresh = this.logAutoRefresh.bind(this);
    this.onColumnClick = this.onColumnClick.bind(this);
    this.applySortProps = this.applySortProps.bind(this);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.tasks !== this.props.tasks) {
      this.setState({ items: this.props.tasks });
    }
  }

  logAutoRefresh() {
    const { fullLogUrls, tailLogUrls, logListUrl, logType } = this.state;
    getContainerLog(tailLogUrls, fullLogUrls, logType)
      .then(({ text, fullLogLink }) =>
        this.setState(
          prevState =>
            prevState.tailLogUrls[logType] === tailLogUrls[logType] && {
              monacoProps: { value: text },
              monacoFooterButton: (
                <PrimaryButton
                  text='View Full Log'
                  target='_blank'
                  styles={{
                    rootFocused: [ColorClassNames.white],
                  }}
                  href={fullLogLink}
                />
              ),
            },
        ),
      )
      .catch(err => {
        this.setState(
          prevState =>
            prevState.tailLogUrls[logType] === tailLogUrls[logType] && {
              monacoProps: { value: err.message },
            },
        );
        if (err.message === '403') {
          this.showContainerTailLog(logListUrl, logType);
        }
      });
  }

  onDismiss() {
    this.setState({
      monacoProps: null,
      monacoTitle: '',
      monacoFooterButton: null,
      fullLogUrls: {},
      tailLogUrls: {},
    });
  }

  getTimeDuration(startMs, endMs) {
    const start = startMs && DateTime.fromMillis(startMs);
    const end = endMs && DateTime.fromMillis(endMs);
    if (start) {
      return Interval.fromDateTimes(start, end || DateTime.utc()).toDuration([
        'days',
        'hours',
        'minutes',
        'seconds',
      ]);
    } else {
      return null;
    }
  }

  convertObjectFormat(logUrls) {
    const logs = {};
    for (const p in logUrls.locations) {
      logs[logUrls.locations[p].name] = logUrls.locations[p].uri;
    }
    return logs;
  }

  showContainerTailLog(logListUrl, logType) {
    let title;
    let logHint = '';
    this.setState({ logListUrl: logListUrl });
    getContainerLogList(logListUrl)
      .then(({ fullLogUrls, tailLogUrls }) => {
        if (config.logType === 'log-manager') {
          logHint = '最近16KB';
        }
        switch (logType) {
          case 'stdout':
            title = `标准输出 (${logHint})`;
            break;
          case 'stderr':
            title = `标准错误 (${logHint})`;
            break;
          case 'all':
            title = `用户日志 (${logHint}. 注意: 查看合并日志时，日志顺序可能会乱序)`;
            break;
          default:
            throw new Error(`不支持日志类型`);
        }
        this.setState(
          {
            monacoProps: { value: '加载中...' },
            monacoTitle: title,
            fullLogUrls: this.convertObjectFormat(fullLogUrls),
            tailLogUrls: this.convertObjectFormat(tailLogUrls),
            logType,
          },
          () => {
            this.logAutoRefresh(); // start immediately
          },
        );
      })
      .catch(err => {
        this.setState({ monacoProps: { value: err.message } });
      });
  }

  showSshInfo(id, containerPorts, containerIp) {
    const { sshInfo, jobConfig } = this.context;
    const containerSshInfo =
      sshInfo && sshInfo.containers.find(x => x.id === id);
    if (config.launcherType !== 'k8s') {
      if (!containerSshInfo) {
        const res = [];
        res.push('该任务不支持查看SSH信息');
        res.push(
          '请注意，如果您的docker镜像没有openssh服务器和curl包，SSH将不会被启用.\n',
        );
        res.push(
          '解决方案1：使用提交页面上推荐的docker镜像之一.',
        );
        res.push(
          '解决方案2：使用自己的镜像，但为其启用SSH。请按照https://aka.ms/AA5u4sq上的说明操作.',
        );
        this.setState({
          monacoProps: { value: res.join('\n') },
          monacoTitle: `SSH to ${id}`,
        });
      } else {
        const res = [];
        res.push('# Step 1. Open a Bash shell terminal.');
        res.push('# Step 2: Download the private key:');
        res.push(
          `wget '${sshInfo.keyPair.privateKeyDirectDownloadLink}' -O ${sshInfo.keyPair.privateKeyFileName}`,
        );
        res.push('# Step 3: Set correct permission for the key file:');
        res.push(`chmod 400 ${sshInfo.keyPair.privateKeyFileName}`);
        res.push('# Step 4: Connect to the container:');
        res.push(
          `ssh -i ${sshInfo.keyPair.privateKeyFileName} -p ${containerSshInfo.sshPort} root@${containerSshInfo.sshIp}`,
        );
        res.push('');
        this.setState({
          monacoProps: {
            value: res.join('\n'),
            options: {
              wordWrap: 'off',
              readOnly: true,
            },
          },
          monacoTitle: `SSH to ${id}`,
        });
      }
    } else {
      const res = [];
      let hasUserSsh = false;
      if (
        'extras' in jobConfig &&
        'com.microsoft.pai.runtimeplugin' in jobConfig.extras
      ) {
        for (const pluginSetting of jobConfig.extras[
          'com.microsoft.pai.runtimeplugin'
        ]) {
          if (pluginSetting.plugin === 'ssh') {
            if (
              'parameters' in pluginSetting &&
              'userssh' in pluginSetting.parameters &&
              !isEmpty(pluginSetting.parameters.userssh)
            ) {
              hasUserSsh = true;
              break;
            }
          }
        }
      }
      if (hasUserSsh) {
        res.push(
          'You can connect to this container by one of the following commands if SSH is set up properly: \n',
        );
        res.push(`1. Use your default SSH private key:\n`);
        res.push(`ssh -p ${containerPorts.ssh} root@${containerIp}\n`);
        res.push(`2. Use a pre-downloaded SSH private key:\n`);
        res.push(
          `On Windows:\nssh -p ${containerPorts.ssh} -i <your-private-key-file-path> root@${containerIp}\n`,
        );
        res.push(
          `On Unix-like System:\nchmod 400 <your-private-key-file-path> && ssh -p ${containerPorts.ssh} -i <your-private-key-file-path> root@${containerIp}\n\n`,
        );
        res.push(
          `If you are using a different username in your docker, please change "root" to your pre-defined username.`,
        );
      } else {
        res.push('This job does not contain SSH info.');
        res.push(
          'If you want to use SSH, please enable it in the "Tools -> SSH" Section on the Job Submission Page.',
        );
      }
      this.setState({
        monacoProps: {
          value: res.join('\n'),
          options: {
            wordWrap: 'off',
            readOnly: true,
          },
        },
        monacoTitle: `SSH to ${id}`,
      });
    }
  }

  showAllLogDialog(logListUrl) {
    const { hideAllLogsDialog } = this.state;

    getContainerLogList(logListUrl)
      .then(({ fullLogUrls, _ }) => {
        this.setState({
          hideAllLogsDialog: !hideAllLogsDialog,
          fullLogUrls: fullLogUrls,
        });
      })
      .catch(() => this.setState({ hideAllLogsDialog: !hideAllLogsDialog }));
  }

  getTaskPropertyFromColumnKey(item, key) {
    if (key === 'exitType') {
      return !isNil(item.containerExitSpec) &&
        !isNil(item.containerExitSpec.type)
        ? item.containerExitSpec.type
        : null;
    }
    return item[key];
  }

  orderItems(items, ordering) {
    const key = ordering.field;
    return items
      .slice(0)
      .sort((a, b) =>
        (ordering.descending
        ? this.getTaskPropertyFromColumnKey(a, key) <
          this.getTaskPropertyFromColumnKey(b, key)
        : this.getTaskPropertyFromColumnKey(a, key) >
          this.getTaskPropertyFromColumnKey(b, key))
          ? 1
          : -1,
      );
  }

  onColumnClick(event, column) {
    const { field, descending } = this.state.ordering;
    const items = this.state.items;
    let newOrdering = null;
    let newItems = [];
    if (field === column.key) {
      if (descending) {
        newOrdering = { field: null, descending: false };
        newItems = this.props.tasks;
        this.setState({ ordering: newOrdering, items: newItems });
      } else {
        newOrdering = { field: field, descending: true };
        newItems = this.orderItems(items, newOrdering);
        this.setState({ ordering: newOrdering, items: newItems });
      }
    } else {
      newOrdering = { field: column.key, descending: false };
      newItems = this.orderItems(items, newOrdering);
      this.setState({ ordering: newOrdering, items: newItems });
    }
  }

  applySortProps(column) {
    column.isSorted = this.state.ordering.field === column.key;
    column.isSortedDescending = this.state.ordering.descending;
    column.onColumnClick = this.onColumnClick;
    return column;
  }

  onRenderRow(props) {
    return (
      <DetailsRow
        {...props}
        styles={{
          root: {
            color: theme.palette.black,
          },
        }}
      />
    );
  }

  render() {
    const {
      monacoTitle,
      monacoProps,
      monacoFooterButton,
      fullLogUrls,
      tailLogUrls,
      hideAllLogsDialog,
      items,
    } = this.state;
    const { showMoreDiagnostics } = this.props;
    return (
      <div>
        <ThemeProvider theme={theme}>
          <DetailsList
            styles={{ root: { overflow: 'auto' } }}
            columns={this.getColumns(showMoreDiagnostics)}
            disableSelectionZone
            items={items}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
            onRenderRow={this.onRenderRow}
          />
        </ThemeProvider>
        {/* Timer */}
        <Timer
          interval={
            isNil(monacoProps) || isEmpty(tailLogUrls) ? null : interval
          }
          func={this.logAutoRefresh}
        />
        {/* Monaco Editor Panel */}
        <MonacoPanel
          isOpen={!isNil(monacoProps)}
          onDismiss={this.onDismiss}
          title={monacoTitle}
          monacoProps={monacoProps}
          footer={monacoFooterButton}
        />
        <Dialog
          hidden={hideAllLogsDialog}
          onDismiss={() =>
            this.setState({ hideAllLogsDialog: !hideAllLogsDialog })
          }
          minWidth='500px'
        >
          <Stack gap='m'>
            <Text variant='xLarge'>All Logs:</Text>
            <LogDialogContent
              urlLists={
                !isNil(fullLogUrls) && !isNil(fullLogUrls.locations)
                  ? fullLogUrls.locations
                  : []
              }
            />
          </Stack>
          <DialogFooter>
            <PrimaryButton
              onClick={() =>
                this.setState({ hideAllLogsDialog: !hideAllLogsDialog })
              }
              text='Close'
            />
          </DialogFooter>
        </Dialog>
      </div>
    );
  }

  getColumns(showMoreDiagnostics) {
    const taskStateColumn = this.applySortProps({
      key: 'taskState',
      name: '状态',
      headerClassName: FontClassNames.medium,
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: item => <StatusBadge status={capitalize(item.taskState)} />,
    });
    const exitTypeColumn = this.applySortProps({
      key: 'exitType',
      name: '退出类型',
      headerClassName: FontClassNames.medium,
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: item => {
        return (
          <div className={c(FontClassNames.mediumPlus)}>
            {!isNil(item.containerExitSpec) &&
            !isNil(item.containerExitSpec.type)
              ? item.containerExitSpec.type
              : null}
          </div>
        );
      },
    });
    const defaultColumns = [
      {
        key: 'taskIndex',
        name: '索引',
        headerClassName: FontClassNames.medium,
        maxWidth: 50,
        isResizable: true,
        onRender: (item, idx) => {
          return (
            <div className={FontClassNames.mediumPlus}>{item.taskIndex}</div>
          );
        },
      },
      taskStateColumn,
      {
        key: 'retries',
        name: '重试次数',
        headerClassName: FontClassNames.medium,
        maxWidth: 150,
        isResizable: true,
        onRender: (item, idx) => {
          return (
            <Link
              href={`task-attempt.html?username=${userName}&jobName=${jobName}&jobAttemptIndex=${this.props.jobAttemptIndex}&taskRoleName=${this.props.taskRoleName}&taskIndex=${item.taskIndex}`}
            >
              <div className={c(FontClassNames.mediumPlus)}>{item.retries}</div>
            </Link>
          );
        },
      },
      {
        key: 'ip',
        name: 'IP',
        className: FontClassNames.mediumPlus,
        headerClassName: FontClassNames.medium,
        minWidth: 90,
        maxWidth: 140,
        isResizable: true,
        fieldName: 'containerIp',
        onRender: item => {
          const ip = item.containerIp;
          return (
            !isNil(ip) && (
              <div>
                <TooltipHost
                  calloutProps={{
                    isBeakVisible: false,
                  }}
                  tooltipProps={{
                    onRenderContent: () => <IPTooltipContent ip={ip} />,
                  }}
                  directionalHint={DirectionalHint.topLeftEdge}
                >
                  <div>{ip}</div>
                </TooltipHost>
              </div>
            )
          );
        },
      },
      {
        key: 'ports',
        name: '端口',
        className: FontClassNames.mediumPlus,
        headerClassName: FontClassNames.medium,
        minWidth: 150,
        maxWidth: 300,
        isResizable: true,
        onRender: item => {
          const ports = item.containerPorts;
          return (
            !isNil(ports) && (
              <div>
                <TooltipHost
                  calloutProps={{
                    isBeakVisible: false,
                  }}
                  tooltipProps={{
                    onRenderContent: () => <PortTooltipContent ports={ports} />,
                  }}
                  directionalHint={DirectionalHint.topLeftEdge}
                >
                  <div className={c(t.truncate)}>
                    {flatten(
                      Object.entries(ports).map(([key, val], idx) => [
                        idx !== 0 && (
                          <span className={t.ml2} key={`gap-${idx}`}></span>
                        ),
                        `${key}: ${val}`,
                      ]),
                    )}
                  </div>
                </TooltipHost>
              </div>
            )
          );
        },
      },
      {
        key: 'info',
        name: '信息/日志',
        className: localCss.pa0I,
        headerClassName: FontClassNames.medium,
        minWidth: 300,
        maxWidth: 500,
        onRender: item => (
          <div
            className={c(t.h100, t.flex, t.justifyStart, t.itemsCenter, t.ml1)}
          >
            <div className={c(t.flex)} style={{ height: 40 }}>
              <CommandBarButton
                className={c(FontClassNames.mediumPlus)}
                styles={{
                  root: { backgroundColor: 'transparent' },
                  rootDisabled: { backgroundColor: 'transparent' },
                }}
                iconProps={{ iconName: 'CommandPrompt' }}
                text='SSH'
                onClick={() => {
                  this.showSshInfo(
                    item.containerId,
                    item.containerPorts,
                    item.containerIp,
                  );
                }}
                disabled={
                  isNil(item.containerId) || item.taskState !== 'RUNNING'
                }
              />
              <CommandBarButton
                className={FontClassNames.mediumPlus}
                styles={{
                  root: { backgroundColor: 'transparent' },
                  rootDisabled: { backgroundColor: 'transparent' },
                }}
                iconProps={{ iconName: 'TextDocument' }}
                text='标准输出'
                onClick={() =>
                  this.showContainerTailLog(
                    `${config.restServerUri}${item.containerLog}`,
                    'stdout',
                  )
                }
                disabled={isNil(item.containerId) || isNil(item.containerIp)}
              />
              <CommandBarButton
                className={FontClassNames.mediumPlus}
                styles={{
                  root: { backgroundColor: 'transparent' },
                  rootDisabled: { backgroundColor: 'transparent' },
                }}
                iconProps={{ iconName: 'Error' }}
                text='标准错误'
                onClick={() =>
                  this.showContainerTailLog(
                    `${config.restServerUri}${item.containerLog}`,
                    'stderr',
                  )
                }
                disabled={isNil(item.containerId) || isNil(item.containerIp)}
              />
              <CommandBarButton
                className={FontClassNames.mediumPlus}
                styles={{
                  root: { backgroundColor: 'transparent' },
                  rootDisabled: { backgroundColor: 'transparent' },
                }}
                menuIconProps={{ iconName: 'More' }}
                menuProps={{
                  items: [
                    {
                      key: 'mergedLog',
                      name: '合并标准输出和错误',
                      iconProps: { iconName: 'TextDocument' },
                      disabled: isNil(item.containerId),
                      onClick: () =>
                        this.showContainerTailLog(
                          `${config.restServerUri}${item.containerLog}`,
                          'all',
                        ),
                    },
                    {
                      key: 'trackingPage',
                      name: '查看所有日志',
                      iconProps: { iconName: 'Link' },
                      onClick: () => {
                        this.showAllLogDialog(
                          `${config.restServerUri}${item.containerLog}`,
                        );
                      },
                    },
                  ],
                }}
                disabled={isNil(item.containerId)}
              />
            </div>
          </div>
        ),
      },
      exitTypeColumn,
      {
        key: 'exitCode',
        name: '退出码',
        minWidth: 260,
        headerClassName: FontClassNames.medium,
        isResizable: true,
        onRender: item => {
          return isNil(item.containerExitSpec) ? (
            <div className={c(FontClassNames.mediumPlus)}>
              {item.containerExitCode}
            </div>
          ) : (
            <div className={c(FontClassNames.mediumPlus)}>
              {`${item.containerExitCode} (${item.containerExitSpec.phrase})`}
            </div>
          );
        },
      },
    ];
    const optionalColumns = [
      {
        key: 'runningStartTime',
        name: '启动开始时间',
        headerClassName: FontClassNames.medium,
        minWidth: 180,
        maxWidth: 200,
        isResizable: true,
        onRender: item => {
          return (
            <div className={c(FontClassNames.mediumPlus)}>
              {isNil(item.launchedTime)
                ? 'N/A'
                : DateTime.fromMillis(item.launchedTime).toLocaleString(
                    DateTime.DATETIME_MED_WITH_SECONDS,
                  )}
            </div>
          );
        },
      },
      {
        key: 'Duration',
        name: '启动持续时间',
        minWidth: 150,
        headerClassName: FontClassNames.medium,
        isResizable: true,
        onRender: (item, idx) => {
          return (
            <div className={FontClassNames.mediumPlus}>
              {getDurationString(
                this.getTimeDuration(item.launchedTime, item.completedTime),
              )}
            </div>
          );
        },
      },
      {
        key: 'nodeName',
        name: '节点名称',
        headerClassName: FontClassNames.medium,
        minWidth: 100,
        isResizable: true,
        onRender: item => {
          return (
            <div className={c(FontClassNames.mediumPlus)}>
              {item.containerNodeName}
            </div>
          );
        },
      },
      {
        key: 'exitDiagonostic',
        name: '退出诊断',
        headerClassName: FontClassNames.medium,
        minWidth: 200,
        isResizable: true,
        onRender: item => {
          return (
            <CommandBarButton
              className={FontClassNames.mediumPlus}
              styles={{
                root: { backgroundColor: 'transparent' },
                rootDisabled: { backgroundColor: 'transparent' },
              }}
              disabled={
                isNil(item.containerExitDiagnostics) &&
                isNil(item.containerExitSpec)
              }
              text='显示退出诊断结果'
              onClick={() => {
                const result = [];
                // exit spec
                const spec = item.containerExitSpec;
                if (!isNil(spec)) {
                  // divider
                  result.push(Array.from({ length: 80 }, () => '-').join(''));
                  result.push('');
                  // content
                  result.push('[Exit Spec]');
                  result.push('');
                  result.push(yaml.safeDump(spec));
                  result.push('');
                }

                // diagnostics
                const diag = item.containerExitDiagnostics;
                if (!isNil(diag)) {
                  // divider
                  result.push(Array.from({ length: 80 }, () => '-').join(''));
                  result.push('');
                  // content
                  result.push('[Exit Diagnostics]');
                  result.push('');
                  result.push(diag);
                  result.push('');
                }

                this.setState({
                  monacoProps: {
                    language: 'text',
                    value: result.join('\n'),
                    options: {
                      wordWrap: 'off',
                      readOnly: true,
                    },
                  },
                  monacoTitle: `退出诊断结果`,
                });
              }}
            />
          );
        },
      },
      {
        key: 'containerId',
        name: '容器ID',
        headerClassName: FontClassNames.medium,
        minWidth: 300,
        isResizable: true,
        onRender: item => {
          const id = item.containerId;
          return (
            !isNil(id) && (
              <div className={c(t.truncate, FontClassNames.mediumPlus)}>
                {id}
              </div>
            )
          );
        },
      },
    ];

    let columns = defaultColumns;
    if (showMoreDiagnostics) {
      columns = columns.concat(optionalColumns);
    }

    return columns;
  }
}

TaskRoleContainerList.contextType = Context;

TaskRoleContainerList.propTypes = {
  taskRoleName: PropTypes.string,
  tasks: PropTypes.arrayOf(PropTypes.object),
  showMoreDiagnostics: PropTypes.bool,
  jobAttemptIndex: PropTypes.number,
};
