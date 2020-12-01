// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import c from 'classnames';
import PropTypes from 'prop-types';
import {
  Stack,
  getTheme,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  StackItem,
  FontClassNames,
  Link,
  DefaultButton,
} from 'office-ui-fabric-react';
import React, { useMemo, useState } from 'react';

import Card from '../../components/card';
import { UtilizationChart } from './utilization-chart';
import { zeroPaddingClass } from './util';
import { Header } from './header';
import config from '../../config/webportal.config';

import t from '../../components/tachyons.scss';
import { ResourceBar } from './resource-bar';
import GroupDetailDialog from './groupDetailDialog';

const getResouceUtilization = (used, guaranteed) => {
  if (Math.abs(guaranteed) < 1e-5) {
    return 0;
  }
  return used / guaranteed;
};

const getGrantedGroupsDescription = groups => {
  const str = groups.map(group => group.groupname).join();
  if (str.length < 25) {
    return str;
  } else {
    return str.substring(0, 22) + '...';
  }
};

const isAdmin = cookies.get('admin') === 'true';
const vcListColumns = colProps => {
  const columns = [
    {
      key: 'name',
      minWidth: 45,
      maxWidth: 100,
      name: '名称',
      isResizable: true,
      onRender(vc) {
        return (
          <Stack verticalAlign='center' verticalFill>
            {isAdmin ? (
              <Link
                href={'/job-list.html?vcName=' + vc.name}
                className={FontClassNames.mediumPlus}
              >
                {vc.dedicated ? vc.name + ' (dedicated)' : vc.name}
              </Link>
            ) : (
              <div className={FontClassNames.mediumPlus}>
                {vc.dedicated ? vc.name + ' (dedicated)' : vc.name}
              </div>
            )}
          </Stack>
        );
      },
    },
    {
      key: 'allocation',
      minWidth: 80,
      maxWidth: 132,
      name: '资源分配',
      isResizable: true,
      className: zeroPaddingClass,
      onRender(vc) {
        const { resourcesUsed, resourcesTotal } = vc;
        const resourcesGuaranteed = vc.resourcesGuaranteed || resourcesTotal;

        const resouceUtilization = Math.max(
          getResouceUtilization(resourcesUsed.GPUs, resourcesGuaranteed.GPUs),
          getResouceUtilization(
            resourcesUsed.memory,
            resourcesGuaranteed.memory,
          ),
          getResouceUtilization(
            resourcesUsed.vCores,
            resourcesGuaranteed.vCores,
          ),
        );
        return (
          <Stack styles={{ root: [{ height: 98 }] }}>
            <UtilizationChart percentage={resouceUtilization} />
          </Stack>
        );
      },
    },
    {
      key: 'detail',
      minWidth: 100,
      name: '详情: 已用 / (总量 - 不可用)',
      isResizable: true,
      onRender(vc) {
        const { resourcesUsed, resourcesTotal } = vc;
        const resourcesGuaranteed = vc.resourcesGuaranteed || resourcesTotal;
        return (
          <Stack
            gap='s1'
            verticalAlign='center'
            verticalFill
            styles={{ root: { marginRight: 20 } }}
          >
            <StackItem>
              <ResourceBar
                name={'MEM GB'}
                percentage={getResouceUtilization(
                  resourcesUsed.memory,
                  resourcesGuaranteed.memory,
                )}
                tailInfo={`${Math.round(resourcesUsed.memory / 1024)} /
                  (${Math.round(resourcesTotal.memory / 1024)} - ${Math.round(
                  (resourcesTotal.memory - resourcesGuaranteed.memory) / 1024,
                )})
                `}
              />
            </StackItem>
            <StackItem>
              <ResourceBar
                name={'CPU'}
                percentage={getResouceUtilization(
                  resourcesUsed.vCores,
                  resourcesGuaranteed.vCores,
                )}
                tailInfo={`${Math.round(resourcesUsed.vCores)} /
                  (${Math.round(resourcesTotal.vCores)} - ${Math.round(
                  resourcesTotal.vCores - resourcesGuaranteed.vCores,
                )})
                `}
              />
            </StackItem>
            <StackItem>
              <ResourceBar
                name={'GPU'}
                percentage={getResouceUtilization(
                  resourcesUsed.GPUs,
                  resourcesGuaranteed.GPUs,
                )}
                tailInfo={`${Math.round(resourcesUsed.GPUs)} /
                  (${Math.round(resourcesTotal.GPUs)} - ${Math.round(
                  resourcesTotal.GPUs - resourcesGuaranteed.GPUs,
                )})
                `}
              />
            </StackItem>
          </Stack>
        );
      },
    },
  ];

  if (isAdmin && colProps.groups) {
    columns.push({
      key: 'groups',
      minWidth: 250,
      name: '授予的组',
      isResizable: true,
      onRender(vc) {
        const groups = [];
        colProps.groups.forEach(group => {
          const virtualClusters = group.extension.acls.virtualClusters;
          if (
            virtualClusters &&
            (virtualClusters.includes(vc.name) || group.extension.acls.admin)
          ) {
            groups.push(group);
          }
        });
        return (
          <Stack
            horizontal
            verticalAlign='center'
            horizontalAlign='space-between'
            gap='m'
          >
            <div className={FontClassNames.medium}>
              <p>{getGrantedGroupsDescription(groups)}</p>
            </div>
            <DefaultButton
              text='查看详情'
              onClick={() => {
                colProps.setGroupDetails({ vc, groups, hideDialog: false });
              }}
            />
          </Stack>
        );
      },
    });
  }

  return columns;
};

export const VirtualClusterDetailsList = props => {
  const virtualClusters = props.virtualClusters;
  const otherProps = {
    ...props,
  };
  delete otherProps.virtualClusters;
  delete otherProps.groups;
  const vcList = Object.entries(virtualClusters).map(([key, val]) => {
    return { name: key, ...val };
  });
  const [groupDetails, setGroupDetails] = useState({
    hideDialog: true,
    vc: { name: '' },
    groups: [],
  });

  return (
    <>
      <DetailsList
        columns={vcListColumns({
          ...props,
          ...{ setGroupDetails },
        })}
        disableSelectionZone
        items={vcList}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        {...otherProps}
      />
      <GroupDetailDialog
        groupDetails={groupDetails}
        setGroupDetails={setGroupDetails}
      />
    </>
  );
};

VirtualClusterDetailsList.propTypes = {
  virtualClusters: PropTypes.object,
};

export const VirtualClusterStatistics = ({
  style,
  userInfo,
  virtualClusters,
}) => {
  const { spacing } = getTheme();
  const userVC = useMemo(() => {
    if (isAdmin) {
      return virtualClusters;
    } else {
      const result = {};
      for (const [key, val] of Object.entries(virtualClusters)) {
        if (userInfo.virtualCluster && userInfo.virtualCluster.includes(key)) {
          result[key] = val;
        }
      }
      return result;
    }
  }, [userInfo, virtualClusters]);

  return (
    <Card className={t.ph5} style={{ paddingRight: spacing.m, ...style }}>
      <Stack styles={{ root: [{ height: '100%' }] }} gap='l1'>
        <Stack.Item>
          <Header
            headerName={
              isAdmin
                ? `虚拟集群 (${Object.keys(userVC).length})`
                : `虚拟集群 (${Object.keys(userVC).length})`
            }
            linkHref={'/virtual-clusters.html'}
            linkName={'View all'}
            showLink={isAdmin && config.launcherType !== 'k8s'}
          />
        </Stack.Item>
        <Stack.Item styles={{ root: [t.relative] }} grow>
          <div className={c(t.absolute, t.absoluteFill, t.overflowAuto, t.pr4)}>
            <VirtualClusterDetailsList
              styles={{ root: { overflow: 'unset' } }}
              virtualClusters={userVC}
            />
          </div>
        </Stack.Item>
      </Stack>
    </Card>
  );
};

VirtualClusterStatistics.propTypes = {
  style: PropTypes.object,
  userInfo: PropTypes.object.isRequired,
  virtualClusters: PropTypes.object.isRequired,
};
