// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useLayoutEffect, useState, useCallback, useMemo } from 'react';

import {
  Checkbox,
  DefaultButton,
  DetailsList,
  SelectionMode,
  Stack,
  FontClassNames,
  FontWeights,
  getTheme,
  DetailsListLayoutMode,
  Text,
} from 'office-ui-fabric-react';
import { TooltipIcon } from '../controls/tooltip-icon';

import c from 'classnames';
import PropTypes from 'prop-types';
import { cloneDeep, isNil } from 'lodash';

import { MountDirectories } from '../../models/data/mount-directories';
import { dispatchResizeEvent } from '../../utils/utils';
import t from '../../../components/tachyons.scss';
import { PROTOCOL_TOOLTIPS } from '../../utils/constants';
import TeamDetail from './team-detail';

const { spacing } = getTheme();

export const TeamStorage = ({
  teamStorageConfigs,
  mountDirs,
  onMountDirChange,
}) => {
  // workaround for fabric's bug
  // https://github.com/OfficeDev/office-ui-fabric-react/issues/5280#issuecomment-489619108
  useLayoutEffect(() => {
    dispatchResizeEvent();
  });

  const selectedConfigNames = useMemo(() => {
    if (isNil(mountDirs) || isNil(mountDirs.selectedConfigs)) {
      return [];
    }
    return mountDirs.selectedConfigs.map(element => {
      return element.name;
    });
  }, [mountDirs]);

  const [teamDetail, setTeamDetail] = useState({ isOpen: false });

  const openTeamDetail = useCallback(config => {
    setTeamDetail({ isOpen: true, config: config, servers: mountDirs.servers });
  });

  const hideTeamDetail = useCallback(() => {
    setTeamDetail({ isOpen: false });
  });

  const updateMountDir = useCallback(
    selectedConfigNames => {
      let selectedConfigs = [];
      if (selectedConfigNames.length > 0) {
        selectedConfigs = teamStorageConfigs.filter(element => {
          return selectedConfigNames.includes(element.name);
        });
      }
      const newMountDirs = cloneDeep(mountDirs);
      newMountDirs.selectedConfigs = selectedConfigs;
      onMountDirChange(newMountDirs);
    },
    [teamStorageConfigs, mountDirs],
  );

  const columns = [
    {
      key: 'name',
      name: '名称',
      headerClassName: FontClassNames.medium,
      minWidth: 160,
      onRender: (item, idx) => {
        return (
          <Checkbox
            key={item.name}
            label={item.name}
            checked={
              selectedConfigNames.length > 0 &&
              selectedConfigNames.includes(item.name)
            }
            onChange={(ev, isChecked) => {
              let newSelectedConfigNames = [];
              if (!isChecked && selectedConfigNames.includes(item.name)) {
                const idx = selectedConfigNames.indexOf(item.name);
                newSelectedConfigNames = [
                  ...selectedConfigNames.slice(0, idx),
                  ...selectedConfigNames.slice(idx + 1),
                ];
              } else if (
                isChecked &&
                !selectedConfigNames.includes(item.name)
              ) {
                newSelectedConfigNames = cloneDeep(selectedConfigNames);
                newSelectedConfigNames.push(item.name);
              }
              updateMountDir(newSelectedConfigNames);
            }}
          />
        );
      },
    },
    {
      key: 'containerPath',
      name: '路径',
      headerClassName: FontClassNames.medium,
      minWidth: 120,
      onRender: item => {
        return (
          <div className={FontClassNames.medium}>
            <div key={item.name}>{`/mnt/${item.name}`}</div>
          </div>
        );
      },
    },
    {
      key: 'permission',
      name: '权限',
      headerClassName: FontClassNames.medium,
      minWidth: 50,
      onRender: item => {
        return (
          <div className={FontClassNames.medium}>
            <div key={item.name + 'per'}>{item.readOnly ? 'RO' : 'RW'}</div>
          </div>
        );
      },
    },
    {
      key: 'detail',
      name: '详情',
      headerClassName: FontClassNames.medium,
      minWidth: 70,
      onRender: item => {
        /**
         * @param {React.MouseEvent} event
         */
        function onClick(event) {
          openTeamDetail(item);
        }

        return (
          <div>
            <DefaultButton text='详情' onClick={onClick} />
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <Stack horizontal verticalAlign='baseline'>
        <Text
          styles={{
            fontWeight: FontWeights.semibold,
            paddingBottom: spacing.m,
          }}
        >
          Team共享存储
        </Text>
        <TooltipIcon content={PROTOCOL_TOOLTIPS.teamStorage} />
      </Stack>

      <div className={c(t.mb2)}>
        <DetailsList
          columns={columns}
          disableSelectionZone
          selectionMode={SelectionMode.none}
          items={teamStorageConfigs}
          layoutMode={DetailsListLayoutMode.fixedColumns}
          compact
        />
      </div>
      {/* <TeamMountList
        dataList={mountDirs ? mountDirs.getTeamDataList() : []}
      /> */}
      {teamDetail.isOpen && (
        <TeamDetail
          isOpen={teamDetail.isOpen}
          config={teamDetail.config}
          servers={teamDetail.servers}
          hide={hideTeamDetail}
        />
      )}
    </div>
  );
};

TeamStorage.propTypes = {
  teamStorageConfigs: PropTypes.array,
  mountDirs: PropTypes.instanceOf(MountDirectories),
  onMountDirChange: PropTypes.func,
};
