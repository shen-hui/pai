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

import { FontClassNames, ColorClassNames } from '@uifabric/styling';
import { PrimaryButton } from 'office-ui-fabric-react';
import MediaQuery from 'react-responsive';
import c from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import { ReactComponent as SignInBackground } from '../../../assets/img/sign-in-background.svg';
import t from 'tachyons-sass/tachyons.scss';

const BREAKPOINT = 960;

const Jumbotron = ({ showLoginModal }) => (
  <div className={c(ColorClassNames.neutralLightBackground, t.ph6)}>
    {/* small */}
    <MediaQuery maxWidth={BREAKPOINT}>
      <div className={c(t.flex, t.flexColumn, t.itemsCenter, t.pv4)}>
        <SignInBackground style={{ maxWidth: '20rem' }} />
        <div className={c(t.flex, t.flexColumn, t.itemsCenter)}>
          <div className={c(FontClassNames.large, t.pt3)}>
            人工智能资源调度管理平台
          </div>
          <div
            className={c(FontClassNames.mediumPlus, t.tc, t.lhCopy, t.mv4)}
            style={{ maxWidth: '20rem' }}
          >
            融合微软算力调度项目OpenPAI,突破新型GPU调度、混合云架构、容器和虚机混合编排蓝图部署，适用于人工智能应用的新型API安全网关等场景落地关键技术，
            开发了人工智能资源调度平台，
            <br />
            支持Tensorflow、PyTorch、MXNet、Keras等多种深度学习计算框架，适配智慧金融、智慧物流、智慧医疗等各种人工智能场景，
            具备为数据处理标记、模型开发、模型训练优化和部署全程保驾护航的能力。
          </div>
          <PrimaryButton
            styles={{ root: { maxWidth: '6rem' } }}
            text='登录'
            onClick={showLoginModal}
          />
        </div>
      </div>
    </MediaQuery>
    {/* large */}
    <MediaQuery minWidth={BREAKPOINT + 1}>
      <div
        className={c(t.flex, t.itemsCenter, t.justifyBetween, t.pv5, t.ph4, t.center)}
        style={{ maxWidth: '95%' }}
      >
        <div
          className={c(t.flex, t.flexColumn)}
          style={{ minWidth: '20rem', maxWidth: '60%' }}
        >
          <div className={c(FontClassNames.superLarge)}>
            人工智能资源调度管理平台
          </div>
          <div className={c(FontClassNames.mediumPlus, t.lhCopy, t.mv4)}>
            融合微软算力调度项目OpenPAI,突破新型GPU调度、混合云架构、容器和虚机混合编排蓝图部署，适用于人工智能应用的新型API安全网关等场景落地关键技术，
            开发了人工智能资源调度平台，
            <br />
            支持Tensorflow、PyTorch、MXNet、Keras等多种深度学习计算框架，适配智慧金融、智慧物流、智慧医疗等各种人工智能场景，
            具备为数据处理标记、模型开发、模型训练优化和部署全程保驾护航的能力。
          </div>
          <PrimaryButton
            styles={{ root: { maxWidth: '6rem' } }}
            text='登录'
            onClick={showLoginModal}
          />
        </div>
        <SignInBackground style={{ maxWidth: '28rem', minWidth: '25rem' }} />
      </div>
    </MediaQuery>
  </div>
);

Jumbotron.propTypes = {
  showLoginModal: PropTypes.func,
};

export default Jumbotron;
