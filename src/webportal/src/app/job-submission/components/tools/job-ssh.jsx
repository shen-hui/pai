import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { cloneDeep, isEmpty, isNil } from 'lodash';
import { TooltipIcon } from '../controls/tooltip-icon';
import {
  PAI_PLUGIN,
  USERSSH_TYPE_OPTIONS,
  SSH_KEY_BITS,
  PROTOCOL_TOOLTIPS,
} from '../../utils/constants';
import { SSHPlugin } from '../../models/plugin/ssh-plugin';
import SSHGenerator from './ssh-generator';

import {
  DefaultButton,
  Dropdown,
  FontWeights,
  Toggle,
  Stack,
  Text,
  TextField,
  FontSizes,
} from 'office-ui-fabric-react';

const style = {
  headerText: {
    root: {
      fontSize: FontSizes.large,
      fontWeight: FontWeights.semibold,
    },
  },
};

export const JobSSH = ({ extras, onExtrasChange }) => {
  const [sshPlugin, setSshPlugin] = useState(SSHPlugin.fromProtocol(extras));

  useEffect(() => {
    const updatedSSHPlugin = SSHPlugin.fromProtocol(extras);
    setSshPlugin(updatedSSHPlugin);
  }, [extras]);

  const _onChangeExtras = useCallback(
    (keyName, propValue) => {
      const updatedSSHPlugin = new SSHPlugin(sshPlugin);
      updatedSSHPlugin[keyName] = propValue;
      setSshPlugin(updatedSSHPlugin);
      const updatedExtras = cloneDeep(extras);
      if (isNil(updatedExtras[PAI_PLUGIN])) {
        updatedExtras[PAI_PLUGIN] = [];
      }
      const pluginBase = updatedExtras[PAI_PLUGIN];
      const oriSshIndex = pluginBase.findIndex(
        plugin => plugin.plugin === 'ssh',
      );
      if (oriSshIndex >= 0) {
        pluginBase[oriSshIndex] = updatedSSHPlugin.convertToProtocolFormat();
      } else {
        pluginBase.push(updatedSSHPlugin.convertToProtocolFormat());
      }
      onExtrasChange(updatedExtras);
    },
    [extras],
  );

  const _onUsersshTypeChange = useCallback(
    (_, item) => {
      _onChangeExtras('userssh', {
        type: item.key,
        value: '',
      });
    },
    [extras, _onChangeExtras],
  );

  const _onUsersshValueChange = useCallback(
    e => {
      _onChangeExtras('userssh', {
        ...sshPlugin.userssh,
        value: e.target.value,
      });
    },
    [extras, _onChangeExtras],
  );

  const _onUsersshEnable = useCallback(
    (_, checked) => {
      if (!checked) {
        _onChangeExtras('userssh', {});
      } else {
        _onChangeExtras('userssh', {
          type: 'custom',
          value: '',
        });
      }
    },
    [_onChangeExtras],
  );

  const [sshGenerator, setSshGenerator] = useState({ isOpen: false });
  const openSshGenerator = (bits, ev) => {
    setSshGenerator({
      isOpen: true,
      bits: SSH_KEY_BITS,
    });
  };
  const hideSshGenerator = () => {
    setSshGenerator({ isOpen: false });
  };

  const _onSshKeysGenerated = sshKeys => {
    _onChangeExtras('userssh', {
      ...sshPlugin.userssh,
      value: sshKeys.public,
    });
  };

  return (
    <Stack gap='m' styles={{ root: { height: '100%' } }}>
      <Stack horizontal verticalAlign='baseline'>
        <Text styles={style.headerText}>SSH</Text>
        <TooltipIcon content={PROTOCOL_TOOLTIPS.ssh} />
      </Stack>
      <Toggle
        label={'使用SSH'}
        inlineLabel={true}
        checked={!isEmpty(sshPlugin.userssh)}
        onChange={_onUsersshEnable}
      />
      {!isEmpty(sshPlugin.userssh) && (
        <Stack horizontal gap='l1'>
          <Dropdown
            placeholder='选择用户ssh密钥类型...'
            options={USERSSH_TYPE_OPTIONS}
            onChange={_onUsersshTypeChange}
            selectedKey={sshPlugin.userssh.type}
            disabled={Object.keys(USERSSH_TYPE_OPTIONS).length <= 1}
          />
          <TextField
            placeholder='输入ssh公钥'
            disabled={sshPlugin.userssh.type === 'none'}
            errorMessage={
              isEmpty(sshPlugin.getUserSshValue())
                ? '输入ssh公钥'
                : null
            }
            onChange={_onUsersshValueChange}
            value={sshPlugin.getUserSshValue()}
          />
          <DefaultButton onClick={ev => openSshGenerator(ev)}>
            SSH密钥生成器
          </DefaultButton>
          {sshGenerator.isOpen && (
            <SSHGenerator
              isOpen={sshGenerator.isOpen}
              bits={sshGenerator.bits}
              hide={hideSshGenerator}
              onSshKeysChange={_onSshKeysGenerated}
            />
          )}
        </Stack>
      )}
    </Stack>
  );
};

JobSSH.propTypes = {
  extras: PropTypes.object,
  onExtrasChange: PropTypes.func.isRequired,
};
