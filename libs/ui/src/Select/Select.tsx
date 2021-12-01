import React, { useMemo } from 'react';
import ReactSelect, { components } from 'react-select';

import { styled } from '../Theme';

import { SelectProps, TOption } from './types';

const SELECT_WIDTH = '100%';
const ZERO_PADDING = 0;
const SELECT_DEFAULT_BORDER = 0;

const SelectWrapper = styled.div`
  display: inline-block;
  margin-right: 15px;
  min-width: 80px;
  padding-right: 15px;
  position: relative;
  width: ${SELECT_WIDTH};

  .react-select {
    &__control {
      appearance: none;
      background-color: ${props => props.theme.background.disabled};
      background-position: 90% center;
      background-repeat: no-repeat;
      background-size: 8px !important;
      border: none;
      border-radius: ${props => props.theme.borderRadius.xs};
      font-size: ${props => props.theme.font.sizes.xs};
      margin-right: 7px;
      max-height: 25px;
      min-height: 25px;
      outline: none;
      padding: ${ZERO_PADDING}px 4px !important;
      width: ${SELECT_WIDTH};
    }

    &__indicator {
      color: ${props => props.theme.text.primary};
      padding: ${ZERO_PADDING}px;
      width: 10px;
    }

    &__value-container {
      padding: ${ZERO_PADDING}px;
    }

    &__single-value {
      color: ${props => props.theme.text.primary};
      margin-left: 2px;
      max-width: 100%;
      position: relative;
      text-overflow: auto;
      transform: none;
    }

    &__menu {
      border: none;
      border-bottom: ${SELECT_DEFAULT_BORDER};
      border-top: ${SELECT_DEFAULT_BORDER};
      background: ${props => props.theme.background.primary};
      border-radius: ${props => props.theme.borderRadius.xs};
      box-shadow: none;
      margin: 0;
      margin-top: 3px;
      width: ${SELECT_WIDTH};
    }

    &__menu-list {
      box-shadow: none;
      padding: ${ZERO_PADDING}px;
    }

    &__option {
      background: transparent;
      color: ${props => props.theme.text.medium};
      font-size: ${props => props.theme.font.sizes.s};
      padding: 5px 6px;

      &:not(:last-child) {
        border-bottom: 1px solid ${props => props.theme.border.secondary};
      }

      &:hover {
        color: ${props => props.theme.text.primary};
      }
    }
  }
`;

function makeOption<Option>(
  rowsText: SelectProps<TOption<Option>>['rowsText'],
  opt: TOption<Option>,
): TOption<Option> {
  if (typeof opt === 'string' || typeof opt === 'number') {
    const suffix = rowsText ? ` ${rowsText}` : '';

    return {
      value: (opt as unknown) as string | number,
      label: String(opt) + suffix,
    } as TOption<Option>;
  }
  return opt;
}

export interface Select<Option> {
  (e: SelectProps<Option>): JSX.Element;
}
export function Select<Option>({
  onChange,
  selected,
  rowsText,
  options,
  className,
  optionComponent: Option,
  singleValueComponent: SingleValue,
}: SelectProps<Option>) {
  const formattedOptions = useMemo(
    () =>
      options.map(item =>
        makeOption<Option>(rowsText, item as TOption<Option>),
      ),
    [options, rowsText],
  );

  const innerComponents = { IndicatorSeperator: null, SingleValue, Option };
  if (!SingleValue) delete innerComponents.SingleValue;
  if (!Option) delete innerComponents.Option;

  const selectedItem =
    typeof selected === 'string' || typeof selected === 'number'
      ? formattedOptions.find(opt => String(opt.value) === String(selected))!
      : selected;

  return (
    <SelectWrapper className={className}>
      <ReactSelect
        value={selectedItem}
        options={formattedOptions}
        onChange={onChange}
        isSearchable={false}
        menuPlacement="auto"
        components={innerComponents}
        hideSelectedOptions={false}
        classNamePrefix="react-select"
        theme={theme => ({
          ...theme,
          borderRadius: 0,
          colors: {
            ...theme.colors,
            primary: 'primary',
          },
        })}
      />
    </SelectWrapper>
  );
}

export const { Option, SingleValue } = components;
