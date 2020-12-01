import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { cloneDeep, isNil, get } from 'lodash';
import { Hint } from '../sidebar/hint';
import { TooltipIcon } from '../controls/tooltip-icon';
import {
  TENSORBOARD_LOG_PATH,
  PAI_PLUGIN,
  PROTOCOL_TOOLTIPS,
} from '../../utils/constants';
import {
  FontWeights,
  Toggle,
  Stack,
  Text,
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

const generateDefaultTensorBoardExtras = port => {
  const tensorBoardExtras = {
    plugin: 'tensorboard',
    parameters: {
      port: port,
      logdir: {
        path: TENSORBOARD_LOG_PATH,
      },
    },
  };
  return tensorBoardExtras;
};

export const TensorBoard = props => {
  const { extras, onChange } = props;

  // TensorBoard will use random port in [10000, 15000)
  const tensorBoardPort = useMemo(
    () => Math.floor(Math.random() * 5000 + 10000),
    [],
  );

  const onTensorBoardChange = useCallback(
    (_, isChecked) => {
      let updatedExtras = cloneDeep(extras);
      if (isNil(updatedExtras)) {
        updatedExtras = {};
      }
      let plugins = get(updatedExtras, [PAI_PLUGIN], []);

      if (isChecked) {
        const tensorBoard = generateDefaultTensorBoardExtras(tensorBoardPort);
        plugins.push(tensorBoard);
      } else {
        plugins = plugins.filter(plugin => plugin.plugin !== 'tensorboard');
      }
      updatedExtras[PAI_PLUGIN] = plugins;
      onChange(updatedExtras);
    },
    [onChange, extras, tensorBoardPort],
  );

  return (
    <Stack gap='m' styles={{ root: { height: '100%' } }}>
      <Stack horizontal verticalAlign='baseline'>
        <Text styles={style.headerText}>TensorBoard</Text>
        <TooltipIcon content={PROTOCOL_TOOLTIPS.tensorboard} />
      </Stack>
      <Hint>
        默认情况下，tensorBoard将读取
        <code>{TENSORBOARD_LOG_PATH}</code> 下的日志，并使用随机端口{' '}
        <code>[10000, 15000)</code>.
      </Hint>
      <Toggle
        label='使用TensorBoard'
        inlineLabel={true}
        checked={
          !isNil(
            get(extras, [PAI_PLUGIN], []).find(
              plugin => plugin.plugin === 'tensorboard',
            ),
          )
        }
        onChange={onTensorBoardChange}
      />
    </Stack>
  );
};

TensorBoard.propTypes = {
  extras: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
