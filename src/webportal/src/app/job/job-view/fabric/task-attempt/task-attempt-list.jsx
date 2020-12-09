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

import { ColorClassNames, FontClassNames, getTheme } from '@uifabric/styling';
import c from 'classnames';
import { capitalize, isEmpty, isNil, flatten } from 'lodash';
import { DateTime, Interval } from 'luxon';
import {
  CommandBarButton,
  PrimaryButton,
  Stack,
  Text,
  Dialog,
  DialogFooter,
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
import t from '../../../../components/tachyons.scss';

import { getContainerLog, getContainerLogList } from './conn';
import config from '../../../../config/webportal.config';
import MonacoPanel from '../../../../components/monaco-panel';
import StatusBadge from '../../../../components/status-badge';
import CopyButton from '../../../../components/copy-button';
import { getDurationString } from '../../../../components/util/job';

const theme = getTheme();

const IPTooltipContent = ({ ip }) => {
  return (
    <div>
      <Stack horizontal verticalAlign='center'>
        <div>{`容器IP: ${ip}`}</div>
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

export default class TaskAttemptList extends React.Component {
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
      items: props.taskAttempts,
      ordering: { field: null, descending: false },
      hideAllLogsDialog: true,
    };

    this.showSshInfo = this.showSshInfo.bind(this);
    this.onDismiss = this.onDismiss.bind(this);
    this.showContainerTailLog = this.showContainerTailLog.bind(this);
    this.onRenderRow = this.onRenderRow.bind(this);
    this.convertObjectFormat = this.convertObjectFormat.bind(this);
    this.showAllLogDialog = this.showAllLogDialog.bind(this);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.taskAttempts !== this.props.taskAttempts) {
      this.setState({ items: this.props.taskAttempts });
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
                  text='查看所有log'
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

  showContainerTailLog(logListUrl, logType) {
    let title;
    let logHint = '';
    this.setState({ logListUrl: logListUrl });
    getContainerLogList(logListUrl)
      .then(({ fullLogUrls, tailLogUrls }) => {
        if (config.logType === 'log-manager') {
          logHint = '最新16KB';
        }
        switch (logType) {
          case 'stdout':
            title = `标准输出 (${logHint})`;
            break;
          case 'stderr':
            title = `标准错误 (${logHint})`;
            break;
          case 'all':
            title = `用户日志 (${logHint}. 注意: 合并输出和错误时，日志可能无序排列)`;
            break;
          default:
            throw new Error(`日志类型不支持`);
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
        res.push('这个任务不包含ssh信息.');
        res.push(
          '请注意，如果您的docker镜像没有openssh服务器和curl包，SSH将不会被启用.\n',
        );
        res.push(
          '解决方案1：使用提交页面上推荐的docker镜像.',
        );
        res.push(
          '解决方案2：使用自己的镜像，但为其启用SSH。请按照上的说明操作https://aka.ms/AA5u4sq做这样的工作.',
        );
        this.setState({
          monacoProps: { value: res.join('\n') },
          monacoTitle: `SSH to ${id}`,
        });
      } else {
        const res = [];
        res.push('# 步骤 1. 打开bashshell终端.');
        res.push('# 步骤 2: 下载私钥:');
        res.push(
          `wget '${sshInfo.keyPair.privateKeyDirectDownloadLink}' -O ${sshInfo.keyPair.privateKeyFileName}`,
        );
        res.push('# 步骤 3: 为密钥文件设置正确的权限:');
        res.push(`chmod 400 ${sshInfo.keyPair.privateKeyFileName}`);
        res.push('# 步骤 4: 连接到容器:');
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
          '如果SSH设置正确，可以通过以下命令之一连接到该容器: \n',
        );
        res.push(`1. 使用默认的SSH私钥:\n`);
        res.push(`ssh -p ${containerPorts.ssh} root@${containerIp}\n`);
        res.push(`2. 使用预下载的SSH私钥:\n`);
        res.push(
          `On Windows:\nssh -p ${containerPorts.ssh} -i <your-private-key-file-path> root@${containerIp}\n`,
        );
        res.push(
          `On Unix-like System:\nchmod 400 <your-private-key-file-path> && ssh -p ${containerPorts.ssh} -i <your-private-key-file-path> root@${containerIp}\n\n`,
        );
        res.push(
          `如果您在docker中使用不同的用户名，请将“root”更改为您的预定义用户名.`,
        );
      } else {
        res.push('此任务不包含SSH信息.');
        res.push(
          '如果要使用SSH，请在作业提交页面的“工具->SSH”部分启用它。',
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

  getTaskPropertyFromColumnKey(item, key) {
    if (key === 'exitType') {
      return !isNil(item.containerExitSpec) &&
        !isNil(item.containerExitSpec.type)
        ? item.containerExitSpec.type
        : null;
    }
    return item[key];
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
      items,
      hideAllLogsDialog,
      fullLogUrls,
    } = this.state;
    return (
      <div>
        <DetailsList
          styles={{ root: { overflow: 'auto', padding: '16px' } }}
          columns={this.getColumns()}
          disableSelectionZone
          items={items}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          onRenderRow={this.onRenderRow}
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
            <Text variant='xLarge'>所有日志:</Text>
            <LogDialogContent
              urlLists={!isNil(fullLogUrls) ? fullLogUrls.locations : []}
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

  getColumns() {
    const defaultColumns = [
      {
        key: 'taskAttemptIndex',
        name: 'Task重试索引',
        minWidth: 120,
        headerClassName: FontClassNames.medium,
        isResizable: true,
        onRender: (item, idx) => {
          return (
            <div className={FontClassNames.mediumPlus}>{item.attemptId}</div>
          );
        },
      },
      {
        key: 'taskAttemtState',
        name: 'Task重试状态',
        minWidth: 120,
        headerClassName: FontClassNames.medium,
        isResizable: true,
        onRender: item => (
          <StatusBadge status={capitalize(item.attemptState)} />
        ),
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
          return !isNil(ip) && <div>{ip}</div>;
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
            )
          );
        },
      },
      {
        key: 'info',
        name: '消息日志',
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
                className={FontClassNames.mediumPlus}
                styles={{
                  root: { backgroundColor: 'transparent' },
                  rootDisabled: { backgroundColor: 'transparent' },
                }}
                iconProps={{ iconName: 'TextDocument' }}
                text='输出'
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
                text='错误'
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
                      name: 'Stdout+Stderr',
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
                      name: 'Show All Logs',
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
      {
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
      },
      {
        key: 'taskAttemptExitCode',
        name: '退出码',
        minWidth: 230,
        headerClassName: FontClassNames.medium,
        isResizable: true,
        onRender: (item, idx) => {
          return isNil(item.containerExitSpec) ? (
            <div className={FontClassNames.mediumPlus}>
              {item.containerExitCode}
            </div>
          ) : (
            <div className={FontClassNames.mediumPlus}>
              {`${item.containerExitCode} (${item.containerExitSpec.phrase})`}
            </div>
          );
        },
      },
      {
        key: 'runningStartTime',
        name: '运行启动时间',
        headerClassName: FontClassNames.medium,
        minWidth: 180,
        maxWidth: 200,
        isResizable: true,
        onRender: item => {
          return (
            <div className={c(FontClassNames.mediumPlus)}>
              {isNil(item.currentAttemptLaunchedTime)
                ? 'N/A'
                : DateTime.fromMillis(
                    item.currentAttemptLaunchedTime,
                  ).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}
            </div>
          );
        },
      },
      {
        key: 'taskAttemptDuration',
        name: '运行持续时间',
        minWidth: 150,
        headerClassName: FontClassNames.medium,
        isResizable: true,
        onRender: (item, idx) => {
          return (
            <div className={FontClassNames.mediumPlus}>
              {getDurationString(
                this.getTimeDuration(
                  item.currentAttemptLaunchedTime,
                  item.currentAttemptCompletedTime,
                ),
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
              text='查看退出诊断'
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
                  monacoTitle: `Task退出诊断`,
                });
              }}
            />
          );
        },
      },
      {
        key: 'containerId',
        name: '容器 ID',
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
    const columns = defaultColumns;
    return columns;
  }
}

TaskAttemptList.propTypes = {
  taskAttempts: PropTypes.arrayOf(PropTypes.object),
};
