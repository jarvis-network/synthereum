import { ActionMeta, ValueType } from 'react-select';

export interface IOptions {
  value: number | string;
  label: string;
}

export interface SelectProps {
  onChange: (
    value: ValueType<IOptions, false>,
    actionMeta: ActionMeta<IOptions>,
  ) => void;
  selected: IOptions | string | number;
  rowsText: string;
  options: (IOptions | string | number)[];
  className?: string;
}
