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

import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

import c from 'classnames';
import { isEmpty } from 'lodash';
import { FontClassNames, FontWeights } from '@uifabric/styling';
import {
  DefaultButton,
  PrimaryButton,
  DialogType,
  Dialog,
  DialogFooter,
  TextField,
  Icon,
  TooltipHost,
} from 'office-ui-fabric-react';

import config from '../../../config/webportal.config';
import { checkEmail, checkPassword } from '../utils';

import { ReactComponent as IconUser } from '../../../../assets/img/profile-user.svg';
import { ReactComponent as IconAdmin } from '../../../../assets/img/profile-admin.svg';
import t from '../../../components/tachyons.scss';

const DIALOG_PROFILE = 1;
const DIALOG_PASSWORD = 2;

const UserProfileHeader = ({ userInfo, onEditProfile, onEditPassword }) => {
  const [dialog, setDialog] = useState(0);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const oldPasswordRef = useRef();
  const newPasswordRef = useRef();
  const confirmNewPasswordRef = useRef();
  const emailRef = useRef();

  const onSavePassword = useCallback(() => {
    const oldPassword = oldPasswordRef.current && oldPasswordRef.current.value;
    let error = checkPassword(oldPassword);
    if (error) {
      setError(error);
      return;
    }
    const newPassword = newPasswordRef.current && newPasswordRef.current.value;
    error = checkPassword(newPassword);
    if (error) {
      setError(error);
      return;
    }
    const confirmNewPassword =
      confirmNewPasswordRef.current && confirmNewPasswordRef.current.value;
    if (confirmNewPassword !== newPassword) {
      setError('请再输一次密码');
      return;
    }
    setProcessing(true);
    onEditPassword({ newPassword, oldPassword }).finally(() =>
      setProcessing(false),
    );
  });

  const onSaveProfile = useCallback(() => {
    const email = emailRef.current && emailRef.current.value;
    if (email === userInfo.email) {
      return;
    }
    const error = checkEmail(email);
    if (error) {
      setError(error);
      return;
    }
    setProcessing(true);
    onEditProfile({ email }).finally(() => setProcessing(false));
  });

  return (
    <div className={c(t.flex, t.justifyBetween)}>
      {/* summary left */}
      <div>
        <div className={c(t.flex, t.itemsBaseline)}>
          <div
            className={FontClassNames.xxLarge}
            style={{ fontWeight: FontWeights.regular }}
          >
            {userInfo.username}
          </div>
          <div className={t.ml3}>
            <TooltipHost
              content={userInfo.admin ? 'Admin' : 'User'}
              calloutProps={{
                isBeakVisible: false,
                gapSpace: 8,
              }}
            >
              <div>{userInfo.admin ? <IconAdmin /> : <IconUser />}</div>
            </TooltipHost>
          </div>
        </div>
        <div className={c(t.mt5, t.flex)}>
          <div className={c(t.flex, t.itemsCenter)}>
            <div>
              <Icon iconName='Mail' />
            </div>
            <div className={c(t.ml3, FontClassNames.medium)}>
              {userInfo.email}
            </div>
          </div>
          <div className={c(t.ml6, t.flex, t.itemsCenter)}>
            <div>
              <Icon iconName='Group' />
            </div>
            <div className={c(t.ml3, FontClassNames.medium)}>
              {userInfo.grouplist.join(', ')}
            </div>
          </div>
        </div>
      </div>
      {/* summary right */}
      {config.authnMethod !== 'OIDC' && (
        <div className={c(t.flex, t.flexColumn, t.mt2)}>
          <div>
            <PrimaryButton
              styles={{
                root: {
                  width: 140,
                },
              }}
              onClick={() => setDialog(DIALOG_PROFILE)}
            >
              编辑个人资料
            </PrimaryButton>
          </div>
          <div className={t.mt3}>
            <DefaultButton
              styles={{
                root: {
                  width: 140,
                },
              }}
              onClick={() => setDialog(DIALOG_PASSWORD)}
            >
              修改密码
            </DefaultButton>
          </div>
          {/* error dialog */}
          <Dialog
            hidden={isEmpty(error)}
            onDismiss={() => setError('')}
            dialogContentProps={{
              type: DialogType.normal,
              title: 'Error',
              subText: error,
            }}
            modalProps={{
              isBlocking: true,
            }}
          >
            <DialogFooter>
              <DefaultButton onClick={() => setError('')}>OK</DefaultButton>
            </DialogFooter>
          </Dialog>
          {/* profile dialog */}
          <Dialog
            hidden={dialog !== DIALOG_PROFILE}
            onDismiss={() => setDialog(0)}
            dialogContentProps={{
              type: DialogType.normal,
              title: '编辑个人资料',
            }}
            modalProps={{
              isBlocking: true,
            }}
            minWidth={400}
          >
            <div>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td className={c(t.pa2, t.tr)}>用户名</td>
                    <td className={t.pa3}>{userInfo.username}</td>
                  </tr>
                  <tr>
                    <td className={c(t.pa2, t.tr)}>邮箱</td>
                    <td className={t.pa3}>
                      <TextField
                        componentRef={emailRef}
                        defaultValue={userInfo.email}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <PrimaryButton
                onClick={onSaveProfile}
                disabled={processing}
                text='保存'
              />
              <DefaultButton
                onClick={() => setDialog(0)}
                disabled={processing}
                text='取消'
              />
            </DialogFooter>
          </Dialog>
          {/* password dialog */}
          <Dialog
            hidden={dialog !== DIALOG_PASSWORD}
            onDismiss={() => setDialog(0)}
            dialogContentProps={{
              type: DialogType.normal,
              title: '修改密码',
            }}
            modalProps={{
              isBlocking: true,
            }}
            minWidth={400}
          >
            <div>
              <div>
               一旦密码被修改，所有token将会被撤回，需要重新登录使用
              </div>
              <div className={t.mt3}>
                <TextField
                  label='旧密码'
                  componentRef={oldPasswordRef}
                  type='password'
                />
              </div>
              <div className={t.mt3}>
                <TextField
                  label='新密码'
                  componentRef={newPasswordRef}
                  type='password'
                  autoComplete='new-password'
                />
              </div>
              <div className={t.mt3}>
                <TextField
                  label='再次输入新密码'
                  componentRef={confirmNewPasswordRef}
                  type='password'
                  autoComplete='new-password'
                />
              </div>
            </div>
            <DialogFooter>
              <PrimaryButton
                onClick={onSavePassword}
                disabled={processing}
                text='保存'
              />
              <DefaultButton
                onClick={() => setDialog(0)}
                disabled={processing}
                text='取消'
              />
            </DialogFooter>
          </Dialog>
        </div>
      )}
    </div>
  );
};

UserProfileHeader.propTypes = {
  userInfo: PropTypes.object,
  onEditProfile: PropTypes.func.isRequired,
  onEditPassword: PropTypes.func.isRequired,
};

export default UserProfileHeader;
