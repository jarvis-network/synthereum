import React from 'react';

import { DataGridColumnProps } from '../types';

export type RangeCellProps = Required<
  Pick<DataGridColumnProps, 'downColor' | 'upColor'>
>;
const RangeCell = (columnProps: RangeCellProps, value: number) => (
  <div className={value >= 0 ? columnProps.downColor : columnProps.upColor}>
    {value}
  </div>
);
export default RangeCell;
