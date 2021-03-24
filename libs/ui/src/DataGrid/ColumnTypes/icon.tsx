import React from 'react';

import { DataGridColumnProps } from '../types';

import { Icon } from '../../Icon';
import { IconKeys } from '../../Icon/Icon';

export type IconCellProps = Required<
  Pick<DataGridColumnProps, 'icon' | 'onClick'>
>;
const IconCell: React.FC<IconCellProps> = ({ onClick, icon }, data) => (
  <button type="button" onClick={e => onClick(e, data)} className="icon-btn">
    <Icon className="table-icon" icon={icon as IconKeys} />
  </button>
);
export default IconCell;
