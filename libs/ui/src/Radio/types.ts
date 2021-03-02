import React, { ChangeEvent, CSSProperties } from 'react';

export type RadioValue = string;

export type RadioChangeEvent = ChangeEvent<HTMLInputElement>;

export interface BasicRadioProps {
  value?: RadioValue;
  children?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
  style?: CSSProperties;
}

export interface RadioGroupProps extends BasicRadioProps {
  onChange?: (value: RadioValue) => void;
}

export interface RadioProps extends BasicRadioProps {
  onChange?: (e: RadioChangeEvent) => void;
  checked?: boolean;
}

export interface RadioGroupContextProps
  extends Pick<BasicRadioProps, 'value' | 'disabled' | 'name'> {
  onChange: (e: RadioChangeEvent) => void;
}

export const RadioGroupContext = React.createContext<RadioGroupContextProps | null>(
  null,
);

export const RadioGroupContextProvider = RadioGroupContext.Provider;
