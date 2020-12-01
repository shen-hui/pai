// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FontClassNames } from '@uifabric/styling';
import c from 'classnames';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import {
  Dialog,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
} from 'office-ui-fabric-react';
import CopyButton from '../../components/copy-button';

import t from '../../components/tachyons.scss';

const CopySucceeded = props =>
  props.copied ? <p style={{ color: 'green' }}>复制成功!</p> : null;

CopySucceeded.propTypes = {
  copied: PropTypes.bool,
};

export default function GroupDetailDialog(props) {
  const { groupDetails, setGroupDetails } = props;
  const [copiedName, setCopiedName] = useState(null);

  return (
    <Dialog
      minWidth='50%'
      hidden={groupDetails.hideDialog}
      onDismiss={() => {
        setGroupDetails({ ...groupDetails, ...{ hideDialog: true } });
      }}
      styles={{ borderStyle: 'solid' }}
      dialogContentProps={{
        title: `虚拟集群授予组 '${groupDetails.vc.name}'`,
      }}
    >
      <DetailsList
        columns={[
          {
            key: 'name',
            minWidth: 100,
            maxWidth: 150,
            name: '组名称',
            isResizable: true,
            onRender(group) {
              return (
                <div
                  className={c(
                    t.flex,
                    t.itemsCenter,
                    t.h100,
                    FontClassNames.medium,
                  )}
                >
                  {group.groupname}
                </div>
              );
            },
          },
          {
            key: 'alias',
            minWidth: 180,
            maxWidth: 250,
            name: '组别名',
            isResizable: true,
            onRender(group) {
              return (
                <div className={c(t.flex, t.itemsCenter, t.h100)}>
                  <div className={FontClassNames.medium}>
                    {group.externalName}
                  </div>
                  <div className={c(t.flex, t.itemsCenter, t.h100)}>
                    <CopyButton
                      value={group.externalName}
                      hideTooltip={true}
                      callback={() => {
                        setCopiedName(group.externalName);
                      }}
                    />
                    <CopySucceeded copied={copiedName === group.externalName} />
                  </div>
                </div>
              );
            },
          },
          {
            key: 'description',
            minWidth: 180,
            name: '描述',
            isResizable: true,
            onRender(group) {
              return (
                <div
                  className={c(
                    t.flex,
                    t.itemsCenter,
                    t.h100,
                    FontClassNames.medium,
                  )}
                >
                  {group.description}
                </div>
              );
            },
          },
        ]}
        disableSelectionZone
        items={groupDetails.groups}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
      />
    </Dialog>
  );
}

GroupDetailDialog.propTypes = {
  groupDetails: PropTypes.object.isRequired,
  setGroupDetails: PropTypes.func.isRequired,
};
