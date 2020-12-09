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

import {
  FontClassNames,
  FontWeights,
  ColorClassNames,
  IconFontSizes,
} from '@uifabric/styling';
import c from 'classnames';
import { get, isEmpty, isNil } from 'lodash';
import { DateTime } from 'luxon';
import {
  ActionButton,
  DefaultButton,
  Dropdown,
  Link,
  MessageBar,
  MessageBarType,
  TooltipHost,
  DirectionalHint,
  Icon,
} from 'office-ui-fabric-react';
import PropTypes from 'prop-types';
import React from 'react';
import yaml from 'js-yaml';

import t from '../../../../../components/tachyons.scss';

import Card from './card';
import Context from './context';
import Timer from './timer';
import { getTensorBoardUrl, getJobMetricsUrl } from '../conn';
import { printDateTime, isJobV2 } from '../util';
import StatusBadge from '../../../../../components/status-badge';
import {
  getJobDuration,
  getDurationString,
  getHumanizedJobStateString,
  isStoppable,
} from '../../../../../components/util/job';
import config from '../../../../../config/webportal.config';
import StopJobConfirm from '../../JobList/StopJobConfirm';
import CopyButton from '../../../../../components/copy-button';
import CloneButton from './clone-button';

const HintItem = ({ header, children }) => (
  <div className={c(t.flex, t.justifyStart)}>
    <div
      style={{
        width: '160px',
        minWidth: '160px',
        fontWeight: FontWeights.semibold,
      }}
    >
      {header}
    </div>
    <div>{children}</div>
  </div>
);

HintItem.propTypes = {
  header: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default class Summary extends React.Component {
  constructor(props) {
    super(props);
    const { jobInfo } = props;
    let defaultInterval = 10 * 1000;
    if (
      jobInfo.jobStatus.state === 'FAILED' ||
      jobInfo.jobStatus.state === 'SUCCEEDED'
    ) {
      defaultInterval = 0;
    }
    this.state = {
      autoReloadInterval: defaultInterval,
      hideDialog: true,
    };
    this.onChangeInterval = this.onChangeInterval.bind(this);
    this.showJobConfig = this.showJobConfig.bind(this);
    this.showStopJobConfirm = this.showStopJobConfirm.bind(this);
    this.setHideDialog = this.setHideDialog.bind(this);
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.jobInfo.jobStatus.state !== prevProps.jobInfo.jobStatus.state
    ) {
      if (
        this.props.jobInfo.jobStatus.attemptState === 'FAILED' ||
        this.props.jobInfo.jobStatus.attemptState === 'SUCCEEDED'
      ) {
        this.setState({ autoReloadInterval: 0 });
      }
    }
  }

  onChangeInterval(e, item) {
    this.setState({ autoReloadInterval: item.key });
  }

  showStopJobConfirm() {
    this.setState({ hideDialog: false });
  }

  setHideDialog() {
    this.setState({ hideDialog: true });
  }

  showJobConfig() {
    const { rawJobConfig } = this.context;
    if (isJobV2(rawJobConfig)) {
      this.props.showEditor('任务配置', {
        language: 'yaml',
        value: yaml.safeDump(rawJobConfig),
      });
    } else {
      this.props.showEditor('任务配置', {
        language: 'json',
        value: JSON.stringify(rawJobConfig, null, 2),
      });
    }
  }

  getUserFailureHintItems(jobInfo) {
    const result = [];
    const runtimeOutput = get(jobInfo, 'jobStatus.appExitMessages.runtime');
    // reason
    const reason = [];
    // static reason
    const spec = get(jobInfo, 'jobStatus.appExitSpec');
    if (spec && spec.reason) {
      reason.push(<div key='spec-reason'>{spec.reason}</div>);
    }
    // dynamic reason
    if (runtimeOutput && runtimeOutput.reason) {
      reason.push(<div key='runtime-reason'>{runtimeOutput.reason}</div>);
    } else {
      const launcherOutput = get(jobInfo, 'jobStatus.appExitMessages.launcher');
      if (launcherOutput) {
        reason.push(<div key='launcher-reason'>{launcherOutput}</div>);
      }
    }
    if (!isEmpty(reason)) {
      result.push(
        <HintItem key='reason' header='Exit Reason:'>
          {reason}
        </HintItem>,
      );
    }
    // solution
    const solution = [];
    if (runtimeOutput && runtimeOutput.solution) {
      solution.push(<li key='runtime-solution'>{runtimeOutput.solution}</li>);
    }
    if (spec && spec.solution) {
      solution.push(
        ...spec.solution.map((x, i) => <li key={`spec-reason-${i}`}>{x}</li>),
      );
    }
    if (!isEmpty(solution)) {
      result.push(
        <HintItem key='solution' header='Exit Solutions:'>
          <ul className={c(t.pa0, t.ma0)} style={{ listStyle: 'inside' }}>
            {solution}
          </ul>
        </HintItem>,
      );
    }

    return result;
  }

  renderHintMessage() {
    const { jobInfo } = this.props;
    if (!jobInfo) {
      return;
    }

    const state = getHumanizedJobStateString(jobInfo.jobStatus);
    if (state === 'Failed') {
      const result = [];
      const spec = jobInfo.jobStatus.appExitSpec;
      const type = spec && spec.type;
      // exit code
      const code = jobInfo.jobStatus.appExitCode;
      result.push(
        <HintItem key='platform-exit-code' header='Exit Code:'>
          {code}
        </HintItem>,
      );
      // type
      if (type) {
        result.push(
          <HintItem key='type' header='Exit Type:'>
            {type}
          </HintItem>,
        );
      }
      if (type === 'USER_FAILURE' || type === 'UNKNOWN_FAILURE') {
        result.push(...this.getUserFailureHintItems(jobInfo));
      } else {
        result.push(
          <HintItem key='solution' header='Exit Solutions:'>
            Please send the{' '}
            <Link onClick={this.showExitDiagnostics}>exit diagnostics</Link> to
            your administrator for further investigation.
          </HintItem>,
        );
      }

      return (
        <MessageBar messageBarType={MessageBarType.error}>
          <div>{result}</div>
        </MessageBar>
      );
    } else if (state === 'Waiting') {
      const resourceRetries = get(jobInfo, 'jobStatus.retryDetails.resource');
      if (resourceRetries >= 3) {
        return (
          <MessageBar messageBarType={MessageBarType.warning}>
            <div>
              <HintItem key='conflict-retry-count' header='Conflict Count:'>
                {resourceRetries}
              </HintItem>
              <HintItem key='resolution' header='Resolution:'>
                <div>
                  Please adjust the resource requirement in your{' '}
                  <Link onClick={this.showJobConfig}>job config</Link>, or wait
                  till other jobs release more resources back to the system.
                </div>
              </HintItem>
            </div>
          </MessageBar>
        );
      }
    }
  }

  render() {
    const { autoReloadInterval, hideDialog } = this.state;
    const { className, jobInfo, reloading, onStopJob, onReload } = this.props;
    const { rawJobConfig } = this.context;
    const hintMessage = this.renderHintMessage();

    const params = new URLSearchParams(window.location.search);
    const namespace = params.get('username');
    const jobName = params.get('jobName');

    return (
      <div className={className}>
        {/* summary */}
        <Card className={c(t.pv4, t.ph5)}>
          {/* summary-row-1 */}
          <div className={c(t.flex, t.justifyBetween, t.itemsCenter)}>
            <div
              className={c(t.flex, t.itemsCenter)}
              style={{ flexShrink: 1, minWidth: 0 }}
            >
              <div
                className={c(t.truncate, FontClassNames.xxLarge)}
                style={{
                  fontWeight: FontWeights.regular,
                }}
              >
                {jobInfo.name}
              </div>
              {jobInfo.debugId && (
                <div className={t.ml2}>
                  <TooltipHost
                    calloutProps={{
                      isBeakVisible: false,
                    }}
                    delay={0}
                    tooltipProps={{
                      onRenderContent: () => (
                        <div
                          className={c(t.flex, t.itemsCenter)}
                          style={{ maxWidth: 300 }}
                        >
                          <div>DebugID:</div>
                          <div className={c(t.ml2, t.truncate)}>
                            {jobInfo.debugId}
                          </div>
                          <CopyButton value={jobInfo.debugId} />
                        </div>
                      ),
                    }}
                    directionalHint={DirectionalHint.topCenter}
                  >
                    <div>
                      <Icon
                        iconName='Info'
                        styles={{
                          root: [
                            { fontSize: IconFontSizes.medium },
                            ColorClassNames.neutralSecondary,
                          ],
                        }}
                      />
                    </div>
                  </TooltipHost>
                </div>
              )}
            </div>
            <div className={c(t.flex, t.itemsCenter)}>
              <Dropdown
                styles={{
                  title: [FontClassNames.mediumPlus, { border: 0 }],
                }}
                dropdownWidth={180}
                selectedKey={autoReloadInterval}
                onChange={this.onChangeInterval}
                options={[
                  { key: 0, text: '禁用自动刷新' },
                  { key: 10000, text: '每10s刷新一次' },
                  { key: 30000, text: '每30s刷新一次' },
                  { key: 60000, text: '每60s刷新一次' },
                ]}
              />
              <ActionButton
                className={t.ml2}
                styles={{ root: [FontClassNames.mediumPlus] }}
                iconProps={{ iconName: 'Refresh' }}
                disabled={reloading}
                onClick={onReload}
              >
                刷新
              </ActionButton>
            </div>
          </div>
          {/* summary-row-2 */}
          <div className={c(t.mt4, t.flex, t.itemsStart)}>
            <div>
              <div className={c(t.gray, FontClassNames.medium)}>任务状态</div>
              <div className={c(t.mt3)}>
                <StatusBadge
                  status={getHumanizedJobStateString(jobInfo.jobStatus)}
                />
              </div>
            </div>
            <div className={t.ml4}>
              <div className={c(t.gray, FontClassNames.medium)}>
                提交时间
              </div>
              <div className={c(t.mt3, FontClassNames.mediumPlus)}>
                {printDateTime(
                  DateTime.fromMillis(jobInfo.jobStatus.submissionTime),
                )}
              </div>
            </div>
            <div className={t.ml4}>
              <div className={c(t.gray, FontClassNames.medium)}>用户</div>
              <div className={c(t.mt3, FontClassNames.mediumPlus)}>
                {jobInfo.jobStatus.username}
              </div>
            </div>
            <div className={t.ml4}>
              <div className={c(t.gray, FontClassNames.medium)}>
                虚拟集群
              </div>
              <div className={c(t.mt3, FontClassNames.mediumPlus)}>
                {jobInfo.jobStatus.virtualCluster}
              </div>
            </div>
            <div className={t.ml4}>
              <div className={c(t.gray, FontClassNames.medium)}>持续时间</div>
              <div className={c(t.mt3, FontClassNames.mediumPlus)}>
                {getDurationString(getJobDuration(jobInfo.jobStatus))}
              </div>
            </div>
            <div className={t.ml4}>
              <div className={c(t.gray, FontClassNames.medium)}>重试次数</div>
              <div className={c(t.mt3, FontClassNames.mediumPlus)}>
                {jobInfo.jobStatus.retries}
              </div>
            </div>
          </div>
          {/* summary-row-2.5 error info */}
          {hintMessage && <div className={t.mt4}>{hintMessage}</div>}
          {/* summary-row-3 */}
          <div className={c(t.mt4, t.flex, t.justifyBetween, t.itemsCenter)}>
            <div className={c(t.flex)}>
              <Link
                styles={{ root: [FontClassNames.mediumPlus] }}
                href='#'
                disabled={isNil(rawJobConfig)}
                onClick={this.showJobConfig}
              >
                查看任务配置
              </Link>
              {config.launcherType !== 'k8s' && (
                <React.Fragment>
                  <div className={c(t.bl, t.mh3)}></div>
                  <Link
                    styles={{ root: [FontClassNames.mediumPlus] }}
                    href={jobInfo.jobStatus.appTrackingUrl}
                    disabled={isNil(jobInfo.jobStatus.appTrackingUrl)}
                    target='_blank'
                  >
                    跳转至应用程序跟踪页
                  </Link>
                </React.Fragment>
              )}
              <div className={c(t.bl, t.mh3)}></div>
              <Link
                styles={{ root: [FontClassNames.mediumPlus] }}
                href={getJobMetricsUrl(jobInfo)}
                target='_blank'
              >
                查看监控指标
              </Link>
              <div className={c(t.bl, t.mh3)}></div>
              <Link
                styles={{ root: [FontClassNames.mediumPlus] }}
                href={`job-event.html?userName=${namespace}&jobName=${jobName}`}
                target='_blank'
              >
                查看任务事件列表
              </Link>
              {!isNil(getTensorBoardUrl(jobInfo, rawJobConfig)) && (
                <div className={c(t.flex)}>
                  <div className={c(t.bl, t.mh3)}></div>
                  <Link
                    styles={{ root: [FontClassNames.mediumPlus] }}
                    href={getTensorBoardUrl(jobInfo, rawJobConfig)}
                    target='_blank'
                  >
                    查看TensorBoard
                  </Link>
                </div>
              )}
            </div>
            <div>
              <span>
                <CloneButton
                  namespace={namespace}
                  jobName={jobName}
                  rawJobConfig={rawJobConfig}
                  enableTransfer={config.enableJobTransfer === 'true'}
                />
              </span>
              <span className={c(t.ml2)}>
                <DefaultButton
                  text='停止'
                  onClick={this.showStopJobConfirm}
                  disabled={!isStoppable(jobInfo.jobStatus)}
                />
                <StopJobConfirm
                  hideDialog={hideDialog}
                  setHideDialog={this.setHideDialog}
                  stopJob={onStopJob}
                />
              </span>
            </div>
          </div>
          {/* Timer */}
          <Timer
            interval={autoReloadInterval === 0 ? null : autoReloadInterval}
            func={onReload}
          />
        </Card>
      </div>
    );
  }
}

Summary.contextType = Context;

Summary.propTypes = {
  className: PropTypes.string,
  jobInfo: PropTypes.object.isRequired,
  reloading: PropTypes.bool.isRequired,
  onStopJob: PropTypes.func.isRequired,
  onReload: PropTypes.func.isRequired,
  showEditor: PropTypes.func.isRequired,
};
