import { GroupBase, Props } from 'react-select';

export type { SelectComponentsGeneric } from 'react-select/dist/declarations/src/components';
export type { OptionProps, SingleValueProps } from 'react-select';

export type TOption<T> = T extends number | string
  ? { value: T; label: string }
  : T extends { value: unknown; label: string }
  ? T
  : never;
export type BaseValue = number | string;
export type OptionObj = {
  label: string;
  value: BaseValue;
};

export type SelectProps<
  Option extends BaseValue | OptionObj,
  IsMulti extends boolean
> = {
  options: Option[];
  selected: Option extends BaseValue ? Option : OptionObj['value'];
  rowsText?: string;
  className?: string;
} & Omit<
  Props<TOption<Option>, IsMulti, GroupBase<TOption<Option>>>,
  'options' | 'value'
>;
