/*
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React from 'react';
import { Text, Stack, FontWeights, Link } from 'office-ui-fabric-react';
import PropTypes from 'prop-types';

import { ExportConfig } from './export-config';
import { ImportConfig } from './import-config';

export const Topbar = React.memo(
  ({
    jobData,
    jobProtocol,
    onChange,
    extras,
    isSingle,
    history,
    setYamlText,
  }) => {
    return (
      <Stack horizontal horizontalAlign='space-between' padding='0 m'>
        <Stack horizontal gap='m' verticalAlign='baseline'>
          <Text variant='xLarge' styles={{ root: { fontWeight: 'semibold' } }}>
            提交任务
          </Text>
          <Link
            target='_blank'
            href='https://openpai.readthedocs.io/zh_CN/latest/manual/cluster-user/quick-start.html'
            style={{ fontWeight: FontWeights.semibold }}
          >
            {'学习更多 >'}
          </Link>
        </Stack>
        <Stack horizontal gap='s1'>
          <ExportConfig jobData={jobData} jobProtocol={jobProtocol} />
          <ImportConfig
            extras={extras}
            onChange={onChange}
            isSingle={isSingle}
            history={history}
            setYamlText={setYamlText}
          />
        </Stack>
      </Stack>
    );
  },
);

Topbar.propTypes = {
  jobData: PropTypes.object,
  jobProtocol: PropTypes.object,
  onChange: PropTypes.func,
  extras: PropTypes.object.isRequired,
  isSingle: PropTypes.bool,
  history: PropTypes.object,
  setYamlText: PropTypes.func,
};
