/*
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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

import PropTypes from 'prop-types';
import React, { useState, useRef, useMemo } from 'react';
import {
  DetailsList,
  CheckboxVisibility,
  SelectionMode,
  DetailsListLayoutMode,
  IconButton,
  Stack,
  CommandBarButton,
  getTheme,
  Dialog,
  DialogType,
  TextField,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  SpinButton,
  FontClassNames,
} from 'office-ui-fabric-react';
import { BasicSection } from '../basic-section';
import { FormShortSection } from '../form-page';

const PORT_LABEL_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const PortsList = React.memo(({ onChange, ports }) => {
  const [showDialog, setShowDialog] = useState(false);
  const [label, setLabel] = useState('');
  const [currentIdx, setCurrentIdx] = useState();
  const countRef = useRef();

  const onRemove = idx => {
    onChange([...ports.slice(0, idx), ...ports.slice(idx + 1)]);
  };

  const onEdit = idx => {
    setCurrentIdx(idx);
    setLabel(ports[idx].key);
    setShowDialog(true);
  };

  const onDialogSave = () => {
    if (currentIdx == null) {
      onChange([...ports, { key: label, value: countRef.current.value }]);
    } else {
      onChange([
        ...ports.slice(0, currentIdx),
        { key: label, value: countRef.current.value },
        ...ports.slice(currentIdx + 1),
      ]);
    }
    setLabel('');
    setCurrentIdx(null);
    setShowDialog(false);
  };
  const onDialogDismiss = () => {
    setLabel('');
    setCurrentIdx(null);
    setShowDialog(false);
  };

  const labelErrorMessage = useMemo(() => {
    if (!PORT_LABEL_REGEX.test(label)) {
      return '应为^[a-zA-Z_][a-zA-Z0-9_]*$格式的字符串';
    }
    const idx = ports.findIndex(item => item.key === label);
    if (idx !== -1 && idx !== currentIdx) {
      return '复制端口标签';
    }
    return null;
  }, [label]);

  const columns = [
    {
      key: 'name',
      name: '端口',
      minWidth: 60,
      className: FontClassNames.mediumPlus,
      onRender: item => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          {item.key}
        </div>
      ),
    },
    {
      key: 'value',
      name: '数量',
      minWidth: 50,
      className: FontClassNames.mediumPlus,
      onRender: item => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          {item.value}
        </div>
      ),
    },
    {
      key: 'action',
      name: '操作',
      minWidth: 100,
      onRender: (item, idx) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            height: '100%',
          }}
        >
          <Stack horizontal gap='s1'>
            <IconButton
              iconProps={{ iconName: 'Edit' }}
              onClick={() => onEdit(idx)}
            />
            <IconButton
              iconProps={{ iconName: 'Delete' }}
              onClick={() => onRemove(idx)}
            />
          </Stack>
        </div>
      ),
    },
  ];

  const { spacing } = getTheme();

  return (
    <BasicSection sectionLabel='端口管理' sectionOptional>
      <FormShortSection>
        <Stack gap='m'>
          <div>
            <DetailsList
              items={ports}
              columns={columns}
              checkboxVisibility={CheckboxVisibility.hidden}
              layoutMode={DetailsListLayoutMode.justified}
              selectionMode={SelectionMode.none}
              compact
            />
          </div>
          <div>
            <CommandBarButton
              styles={{ root: { padding: spacing.s1 } }}
              iconProps={{ iconName: 'Add' }}
              onClick={() => setShowDialog(true)}
            >
              添加端口
            </CommandBarButton>
            <Dialog
              hidden={!showDialog}
              onDismiss={onDialogDismiss}
              dialogContentProps={{
                type: DialogType.normal,
                title: '添加端口',
              }}
              modalProps={{
                isBlocking: true,
              }}
              minWidth={400}
            >
              <Stack gap='m'>
                <div>
                  <p>端口号将随机分配。</p>
                  <p>
                    <div>
                      {`您可以通过环境变量获取分配的端口值 (如果数量大于1，则以逗号分隔) :`}
                    </div>
                    <code>PAI_PORT_LIST_$taskRole_$taskIndex_$portLabel</code>
                  </p>
                </div>
                <div>
                  <TextField
                    label='端口'
                    value={label}
                    onChange={(e, val) => setLabel(val)}
                    errorMessage={labelErrorMessage}
                  />
                </div>
                <div>
                  <SpinButton
                    label='数量'
                    labelPosition='Top'
                    defaultValue={currentIdx != null && ports[currentIdx].value}
                    min={1}
                    max={100}
                    step={1}
                    componentRef={countRef}
                  />
                </div>
              </Stack>
              <DialogFooter>
                <PrimaryButton
                  onClick={onDialogSave}
                  text='保存'
                  disabled={labelErrorMessage}
                />
                <DefaultButton onClick={onDialogDismiss} text='取消' />
              </DialogFooter>
            </Dialog>
          </div>
        </Stack>
      </FormShortSection>
    </BasicSection>
  );
});

PortsList.propTypes = {
  ports: PropTypes.array,
  onChange: PropTypes.func,
};
