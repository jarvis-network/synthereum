import {
  ActionMeta,
  ValueType,
  SingleValueProps,
  OptionProps as ReactSelectOptionProps,
  OptionTypeBase,
  Props,
} from 'react-select';

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
  optionComponent?: Extract<
    Props<TOption<Option>, false>['components'],
    // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  >['Option'];
  singleValueComponent?: Extract<
    Props<TOption<Option>, false>['components'],
    // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  >['SingleValue'];
  placeholder?: Props<TOption<Option>>['placeholder'];
}

export interface OptionProps<
  OptionType extends OptionTypeBase,
  IsMulti extends boolean
> extends ReactSelectOptionProps<OptionType, IsMulti> {
  data: OptionType;
}

export type { SingleValueProps };
