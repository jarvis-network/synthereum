import React, { FC, useState } from 'react';

import { styled } from '../Theme';

import {
  CheckboxValue,
  CheckboxChangeEvent,
  CheckboxGroupProps,
  CheckboxGroupContextProvider,
} from './types';

const Container = styled.div``;

export const CheckboxGroup: FC<CheckboxGroupProps> = ({
  className,
  style,
  children,
  disabled,
  ...props
}) => {
  const { value: propsValue } = props;

  const [value, setValue] = useState<CheckboxValue[]>(propsValue || []);

  const onCheckboxChange = (e: CheckboxChangeEvent) => {
    const { name } = e.target;

    const optionIndex = value.indexOf(name);
    const newValue = [...value];

    if (optionIndex === -1) {
      newValue.push(name);
    } else {
      newValue.splice(optionIndex, 1);
    }

    setValue(newValue);

    if (props.onChange) {
      props.onChange(newValue);
    }
  };

  return (
    <CheckboxGroupContextProvider
      value={{
        value,
        disabled,
        onChange: onCheckboxChange,
      }}
    >
      <Container className={className || ''} style={style || {}}>
        {children}
      </Container>
    </CheckboxGroupContextProvider>
  );
};
