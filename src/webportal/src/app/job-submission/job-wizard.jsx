// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  getTheme,
  DefaultButton,
  Stack,
  FontSizes,
  FontWeights,
} from 'office-ui-fabric-react';
import { isNil } from 'lodash';

import Card from '../components/card';
import { ReactComponent as IconSingle } from '../../assets/img/job-wizard-single.svg';
import { ReactComponent as IconDistributed } from '../../assets/img/job-wizard-distributed.svg';
import { ReactComponent as IconUpload } from '../../assets/img/job-wizard-upload.svg';
import { JobProtocol } from './models/job-protocol';
import { SpinnerLoading } from '../components/loading';

const WizardButton = ({ children, onClick }) => {
  const { palette, spacing } = getTheme();

  return (
    <DefaultButton
      styles={{
        root: {
          borderRadius: '100%',
          backgroundColor: palette.white,
          boxShadow: `rgba(0, 0, 0, 0.06) 0px 2px 4px, rgba(0, 0, 0, 0.05) 0px 0.5px 1px`,
          width: 215,
          height: 215,
          stroke: palette.black,
        },
        rootHovered: {
          backgroundColor: palette.neutralLight,
        },
        rootPressed: {
          backgroundColor: palette.white,
          borderColor: palette.themePrimary,
          stroke: palette.themePrimary,
        },
      }}
      onClick={onClick}
    >
      <div
        style={{
          padding: spacing.l3,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ width: '100%' }}>{children}</div>
      </div>
    </DefaultButton>
  );
};

WizardButton.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
};

const JobWizard = ({ setYamlText, history }) => {
  const uploadFile = React.createRef();
  const [loading, setLoading] = useState(true);

  const importFile = useCallback(event => {
    event.preventDefault();
    const files = event.target.files;
    if (!files || !files[0]) {
      return;
    }
    const fileReader = new FileReader();
    fileReader.addEventListener('load', () => {
      const text = fileReader.result;
      const valid = JobProtocol.validateFromYaml(text);
      if (valid) {
        alert(`Yaml file is invalid. ${valid}`);
        return;
      }
      try {
        setYamlText(text);
        history.push('/general');
      } catch (err) {
        alert(err.message);
      }
    });
    fileReader.readAsText(files[0]);
  });

  // redirect if job clone or local storage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('op') === 'resubmit') {
      history.replace('/general');
    } else if (!isNil(window.localStorage.getItem('marketItem'))) {
      history.replace('/general');
    } else {
      setLoading(false);
    }
  }, []);

  const { spacing, palette } = getTheme();
  if (loading) {
    return <SpinnerLoading />;
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <Card style={{ margin: `${spacing.l2}`, width: '100%' }}>
        <Stack horizontalAlign='center' padding={100} gap={100}>
          <div
            style={{
              color: palette.themePrimary,
              fontSize: FontSizes.xxLarge,
              fontWeight: FontWeights.semibold,
              alignItems: 'center',
              position: 'absolute',
            }}
          >
            请选择任务类型
          </div>
          <Stack
            horizontal
            horizontalAlign='center'
            gap={120}
            style={{ width: '100%', marginTop: 100 }}
          >
            <Stack horizontalAlign='center' gap={50}>
              <WizardButton
                onClick={() => {
                  uploadFile.current.click();
                }}
              >
                <IconUpload />
              </WizardButton>
              <input
                type='file'
                ref={uploadFile}
                style={{ display: 'none' }}
                accept='.yml,.yaml'
                onChange={importFile}
              />
              <div
                style={{
                  fontSize: FontSizes.large,
                  fontWeight: FontWeights.semibold,
                }}
              >
                导入配置
              </div>
            </Stack>
            <Stack horizontalAlign='center' gap={50}>
              <WizardButton
                onClick={() => {
                  history.push('/single');
                }}
              >
                <IconSingle />
              </WizardButton>
              <div
                style={{
                  fontSize: FontSizes.large,
                  fontWeight: FontWeights.semibold,
                }}
              >
                单任务
              </div>
            </Stack>
            <Stack horizontalAlign='center' gap={50}>
              <WizardButton
                onClick={() => {
                  history.push('/general');
                }}
              >
                <IconDistributed />
              </WizardButton>
              <div
                style={{
                  fontSize: FontSizes.large,
                  fontWeight: FontWeights.semibold,
                }}
              >
                分布式任务
              </div>
            </Stack>
          </Stack>
        </Stack>
      </Card>
    </div>
  );
};

JobWizard.propTypes = {
  setYamlText: PropTypes.func,
  history: PropTypes.object,
};

export default JobWizard;
