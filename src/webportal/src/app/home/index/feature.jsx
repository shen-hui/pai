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

import { FontClassNames, FontWeights } from '@uifabric/styling';
import c from 'classnames';
import{ Icon } from 'office-ui-fabric-react'
import React from 'react';
import t from 'tachyons-sass/tachyons.scss';

const Feature = () => (
  <div>
    <div className={c(t.bgWhite, t.pt5, t.ph6, t.flexL, t.center)}>
      <div
        className={c(
          t.w33L,
          t.w100,
          t.tc,
          t.flex,
          t.flexColumn,
          t.itemsCenter,
          t.justifyBetween,
        )}
      >
        <div className={c(t.flex, t.flexColumn, t.itemsCenter)}>
          <Icon iconName="BuildIssue" title="BuildIssue" style={{ fontSize: '5rem' }}  />
          <div
            className={c(FontClassNames.xxLarge, t.mv4)}
            style={{ fontWeight: FontWeights.semibold }}
          >
            自由定制化课程
          </div>
          <div
            className={c(FontClassNames.mediumPlus, t.lhCopy)}
            style={{ maxWidth: '20rem' }}
          >
            支持多种深度学习框架，包括TensorFlow，PyTorch，MXNet，CNTK，支持一键部署深度学习模型在线预测服务。
          </div>
        </div>
      </div>
      <div
        className={c(
          t.w33L,
          t.w100,
          t.mt0L,
          t.mt5,
          t.tc,
          t.ph4,
          t.flex,
          t.flexColumn,
          t.itemsCenter,
          t.justifyBetween,
        )}
      >
        <div className={c(t.flex, t.flexColumn, t.itemsCenter)}>
          <Icon iconName="DrillExpand" title="DrillExpand" style={{ fontSize: '5rem' }}  />
          <div
            className={c(FontClassNames.xxLarge, t.mv4)}
            style={{ fontWeight: FontWeights.semibold }}
          >
            先进的GPU调度
          </div>
          <div
            className={c(FontClassNames.mediumPlus, t.lhCopy)}
            style={{ maxWidth: '20rem' }}
          >
            支持GPU和CPU进行模型训练，根据用户需求调度和分配GPU等计算资源的能力，提高模型训练的效率。
          </div>
        </div>
      </div>
      <div
        className={c(
          t.w33L,
          t.w100,
          t.mt0L,
          t.mt5,
          t.tc,
          t.flex,
          t.flexColumn,
          t.itemsCenter,
          t.justifyBetween,
        )}
      >
        <div className={c(t.flex, t.flexColumn, t.itemsCenter)}>
          <Icon iconName="GroupObject" title="GroupObject" style={{ fontSize: '5rem' }}  />
          <div
            className={c(FontClassNames.xxLarge, t.mv4)}
            style={{ fontWeight: FontWeights.semibold }}
          >
            超大规模异构计算能力
          </div>
          <div
            className={c(FontClassNames.mediumPlus, t.lhCopy)}
            style={{ maxWidth: '20rem' }}
          >
            支持云端和本地算力的混合云架构，实现高效的算力迁移。单任务支持上百worker并发执行，支持500+超大规模异构计算集群。
          </div>
        </div>
      </div>
    </div>
    <div className={c(t.bgWhite, t.pt5, t.pb5, t.ph6, t.flexL, t.center)}>
      <div
        className={c(
          t.w33L,
          t.w100,
          t.tc,
          t.flex,
          t.flexColumn,
          t.itemsCenter,
          t.justifyBetween,
        )}
      >
        <div className={c(t.flex, t.flexColumn, t.itemsCenter)}>
          <Icon iconName="ExternalTFVC" title="ExternalTFVC" style={{ fontSize: '5rem' }}  />
          <div
            className={c(FontClassNames.xxLarge, t.mv4)}
            style={{ fontWeight: FontWeights.semibold }}
          >
            资源市场统一管理
          </div>
          <div
            className={c(FontClassNames.mediumPlus, t.lhCopy)}
            style={{ maxWidth: '20rem' }}
          >
            平台针对培训业务用途进行功能适配和开发，包括Notebook服务、数据共享及管理等 ，共享资源市场：提供资源共享市场，实现模型、算法、数据、镜像等的共享 。
          </div>
        </div>
      </div>
      <div
        className={c(
          t.w33L,
          t.w100,
          t.mt0L,
          t.mt5,
          t.tc,
          t.ph4,
          t.flex,
          t.flexColumn,
          t.itemsCenter,
          t.justifyBetween,
        )}
      >
        <div className={c(t.flex, t.flexColumn, t.itemsCenter)}>
          <Icon iconName="ATPLogo" title="ATPLogo" style={{ fontSize: '5rem' }}  />
          <div
            className={c(FontClassNames.xxLarge, t.mv4)}
            style={{ fontWeight: FontWeights.semibold }}
          >
            高安全保障下的PB级存储
          </div>
          <div
            className={c(FontClassNames.mediumPlus, t.lhCopy)}
            style={{ maxWidth: '20rem' }}
          >
            支持多种数据存储方式和访问协议（HDFS、NFS、Azure Blob）。平台软件提供基于Azure AD的安全认证和授权机制。支持PB级可扩展数据存储资源的管理及调度。
          </div>
        </div>
      </div>
      <div
        className={c(
          t.w33L,
          t.w100,
          t.mt0L,
          t.mt5,
          t.tc,
          t.flex,
          t.flexColumn,
          t.itemsCenter,
          t.justifyBetween,
        )}
      >
        <div className={c(t.flex, t.flexColumn, t.itemsCenter)}>
          <Icon iconName="SearchAndApps" title="SearchAndApps" style={{ fontSize: '5rem' }}  />
          <div
            className={c(FontClassNames.xxLarge, t.mv4)}
            style={{ fontWeight: FontWeights.semibold }}
          >
            全方位监控系统
          </div>
          <div
            className={c(FontClassNames.mediumPlus, t.lhCopy)}
            style={{ maxWidth: '20rem' }}
          >
            为用户提供可视化工具，可管理人工智能任务，包括任务的提交、监控、取消。提供任务在线调试、错误报警、日志管理、性能检测等功能，显著降低了AI平台的日常运维难度。
          </div>
        </div>
      </div>
    </div>
  </div>

);

export default Feature;
