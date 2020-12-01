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

import React, {
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Stack } from 'office-ui-fabric-react';
import PropTypes from 'prop-types';
import Context from '../context';
import { SidebarCard } from './sidebar-card';
import { Hint } from './hint';
import { KeyValueList, getItemsWithError } from '../controls/key-value-list';
import { PROTOCOL_TOOLTIPS } from '../../utils/constants';

const ERROR_ID = 'Secret List';

export const Secrets = React.memo(
  ({ secrets, onChange, selected, onSelect }) => {
    const { setErrorMessage } = useContext(Context);
    const [items, setItems] = useState([]);

    useEffect(() => {
      setItems(secrets);
      setErrorMessage(ERROR_ID, null);
    }, [secrets]);

    const onListChange = useCallback(
      newItems => {
        const itemsWithError = getItemsWithError(newItems);
        const idx = itemsWithError.findIndex(
          item => item.keyError || item.valueError,
        );
        if (idx === -1) {
          onChange(itemsWithError);
          setErrorMessage(ERROR_ID, null);
        } else {
          setItems(itemsWithError);
          setErrorMessage(ERROR_ID, `Invalid item ${idx}`);
        }
      },
      [onChange, setErrorMessage],
    );

    const hasError = useMemo(() => {
      return items.findIndex(item => item.keyError || item.valueError) !== -1;
    }, [items]);

    return (
      <SidebarCard
        title='秘密参数'
        tooltip={PROTOCOL_TOOLTIPS.secrets}
        selected={selected}
        onSelect={onSelect}
        error={hasError}
      >
        <Stack gap='m'>
          <Hint>
            秘密参数是一种特殊类型的参数，在提交后会被屏蔽
            你可以通过如下命令获得{' '}
            <code>{'<% $secrets.secretKey %>'}</code>
          </Hint>
          <div>
            <KeyValueList items={items} onChange={onListChange} />
          </div>
        </Stack>
      </SidebarCard>
    );
  },
);

Secrets.propTypes = {
  secrets: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
};
