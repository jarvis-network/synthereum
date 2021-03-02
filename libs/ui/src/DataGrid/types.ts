import { TableCellRenderer } from 'react-table';

import { IconKeys } from '../Icon/Icon';

export enum ColumnType {
  Text,
  Icon,
  RangeColor,
  CustomCell,
}
export interface DataGridColumnProps {
  key: string;
  header?: string;
  type: ColumnType;
  icon?: IconKeys;
  upColor?: string;
  downColor?: string;
  className?: string;
  onClick?: (
    event: React.MouseEvent<HTMLButtonElement>,
    data: DataRows<any>,
  ) => void | undefined;
  cell?: TableCellRenderer;
  width?: number;
  id?: string;
  minWidth?: number;
}

export type DataRows<T> = {
  [P in keyof T]: T[P];
};
