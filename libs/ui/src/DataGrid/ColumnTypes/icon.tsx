import React from 'react';

import { DataGridColumnProps, DataRows } from '../types';

import { Icon } from '../../Icon';
import { IconKeys } from '../../Icon/Icon';

export type IconCellProps = Required<
  Pick<DataGridColumnProps, 'icon' | 'onClick'>
>;
const IconCell = (columnProps: IconCellProps, data: DataRows<any>) => (
  <button
    type="button"
    onClick={e => columnProps.onClick(e, data)}
    className="icon-btn"
  >
    <Icon className="table-icon" icon={columnProps.icon as IconKeys} />
  </button>
);
export default IconCell;
