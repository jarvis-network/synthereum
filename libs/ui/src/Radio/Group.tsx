import React, { FC, useState } from 'react';

import { styled } from '../Theme';

import {
  RadioGroupProps,
  RadioGroupContextProvider,
  RadioValue,
  RadioChangeEvent,
} from './types';

const Container = styled.div``;

export const RadioGroup: FC<RadioGroupProps> = ({
  className,
  style,
  children,
  disabled,
  name,
  ...props
}) => {
  const { value: propsValue } = props;

  const [value, setValue] = useState<RadioValue | undefined>(propsValue);

  const onRadioChange = (e: RadioChangeEvent) => {
    const lastValue = value;
    const newValue = e.target.value;

    setValue(newValue);

    if (props.onChange && newValue !== lastValue) {
      props.onChange(newValue);
    }
  };

  return (
    <RadioGroupContextProvider
      value={{
        value,
        disabled,
        name,
        onChange: onRadioChange,
      }}
    >
      <Container className={className || ''} style={style || {}}>
        {children}
      </Container>
    </RadioGroupContextProvider>
  );
};
