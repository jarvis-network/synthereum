import React from 'react';

import { DataGridColumnProps } from '../types';

export type RangeCellProps = Required<
  Pick<DataGridColumnProps, 'downColor' | 'upColor'>
>;
const RangeCell = ({ downColor, upColor }: RangeCellProps, value: number) => (
  <div className={value >= 0 ? downColor : upColor}>{value}</div>
);
export default RangeCell;
