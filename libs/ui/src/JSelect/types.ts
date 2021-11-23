import {
  ActionMeta,
  ValueType,
  SingleValueProps,
  OptionProps as ReactSelectOptionProps,
  OptionTypeBase,
} from 'react-select';
import { ComponentType } from 'react';

export type TOption<T> = T extends number | string
  ? { value: T; label: string }
  : T extends { value: unknown; label: string }
  ? T
  : never;

export interface SelectProps<Option> {
  onChange: (
    value: ValueType<TOption<Option>, false>,
    actionMeta: ActionMeta<TOption<Option>>,
  ) => void;
  selected: TOption<Option> | string | number;
  rowsText: string;
  options: (TOption<Option> | string | number)[];
  className?: string;
  optionComponent?: ComponentType<OptionProps<TOption<Option>, false>>;
  singleValueComponent?: ComponentType<SingleValueProps<TOption<Option>>>;
}

export interface OptionProps<
  OptionType extends OptionTypeBase,
  IsMulti extends boolean
> extends ReactSelectOptionProps<OptionType, IsMulti> {
  data: OptionType;
}

export type { SingleValueProps };
