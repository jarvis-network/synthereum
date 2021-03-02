import { ActionMeta, ValueType } from 'react-select';

export interface IOptions {
  value: number | string;
  label: string;
}

export interface SelectProps {
  onChange: (
    value: ValueType<IOptions, true>,
    actionMeta: ActionMeta<IOptions>,
  ) => void;
  selected: string | number;
  rowsText: string;
  options: Array<string>;
}
