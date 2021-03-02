import React, { FC, useContext } from 'react';

import { styled } from '../Theme';
import { Label } from '../Label';

import { RadioProps, RadioGroupContext, RadioChangeEvent } from './types';

const Container = styled.label`
  color: ${props => props.theme.text.primary};
  display: inline-block;
  font-size: ${props => props.theme.font.sizes.m};
  padding: 8px;
  position: relative;

  .label {
    color: inherit;
    font-size: inherit;
    font-weight: normal;
  }

  input {
    width: 16px;
    height: 16px;
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0;
  }

  i {
    background-color: ${props => props.theme.background.primary};
    border: 1px solid ${props => props.theme.text.secondary};
    display: inline-block;
    height: 16px;
    margin-bottom: -4px;
    margin-right: 8px;
    position: relative;
    width: 16px;

    &,
    &::before {
      border-radius: 50%;
    }

    &::before {
      bottom: 4px;
      content: '';
      left: 4px;
      position: absolute;
      right: 4px;
      top: 4px;
      transition: background 0.1s ease-in-out;
    }
  }

  input:focus ~ i {
    box-shadow: 0 0 3px 0px ${props => props.theme.common.primary};
  }

  input:checked ~ i::before {
    background-color: ${props => props.theme.common.success};
  }

  input:disabled ~ i {
    background-color: ${props => props.theme.gray.gray300};
  }

  input:checked:disabled ~ i::before {
    background-color: ${props => props.theme.gray.gray300};
  }

  input:active:not(:disabled) ~ i::before {
    background-color: ${props => props.theme.gray.gray300};
  }
`;

export const Radio: FC<RadioProps> = ({
  children,
  className,
  style,
  ...props
}) => {
  const { name, value } = props;

  const context = useContext(RadioGroupContext);

  const onChange = (e: RadioChangeEvent) => {
    if (props.onChange) {
      props.onChange(e);
    }

    if (context?.onChange) {
      context.onChange(e);
    }
  };

  const inputProps: RadioProps = { ...props };

  if (context) {
    inputProps.name = context.name;
    inputProps.onChange = onChange;
    inputProps.checked = props.value === context.value;
    inputProps.disabled = props.disabled || context.disabled;
  }

  const inputName =
    `${inputProps.name}-${value}` ||
    `${name}-${value}` ||
    `input-${Math.random()}`;

  return (
    <Container
      className={className || ''}
      style={style || {}}
      htmlFor={inputName}
    >
      <input id={inputName} type="radio" {...inputProps} /> <i />{' '}
      <Label className="label">{children || null}</Label>
    </Container>
  );
};
