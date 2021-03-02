import React, { ChangeEvent, CSSProperties } from 'react';

export type CheckboxValue = string;

export type CheckboxChangeEvent = ChangeEvent<HTMLInputElement>;

export interface BasicCheckboxProps {
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
  disabled?: boolean;
}

export interface CheckboxProps extends BasicCheckboxProps {
  name: CheckboxValue;
  checked?: boolean;
  onChange?: (e: CheckboxChangeEvent) => void;
}

export interface CheckboxGroupProps extends BasicCheckboxProps {
  value?: CheckboxValue[];
  onChange?: (value: CheckboxValue[]) => void;
}

export interface CheckboxGroupContextProps {
  disabled?: boolean;
  value?: CheckboxValue[];
  onChange: (e: CheckboxChangeEvent) => void;
}

export const CheckboxGroupContext = React.createContext<CheckboxGroupContextProps | null>(
  null,
);

export const CheckboxGroupContextProvider = CheckboxGroupContext.Provider;
