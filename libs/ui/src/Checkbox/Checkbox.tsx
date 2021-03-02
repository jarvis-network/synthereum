import React, { FC, useContext } from 'react';

import { styled } from '../Theme';
import { Icon } from '../Icon';
import { Label } from '../Label';

import {
  CheckboxProps,
  CheckboxGroupContext,
  CheckboxChangeEvent,
} from './types';

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

  > i {
    background-color: ${props => props.theme.background.primary};
    border: 1px solid ${props => props.theme.text.secondary};
    color: ${props => props.theme.common.secondary};
    display: inline-block;
    height: 16px;
    margin-right: 8px;
    top: 2px;
    width: 16px;
    position: relative;
    border-radius: ${props => props.theme.borderRadius.xxs};

    > i {
      visibility: hidden;
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

  input:checked ~ i > i {
    visibility: visible;
  }

  input:checked ~ i {
    background-color: ${props => props.theme.gray.gray100};
  }

  input:disabled ~ i {
    color: ${props => props.theme.gray.gray400};
  }

  input:active:not(:disabled) ~ i {
    background-color: ${props => props.theme.gray.gray300};
  }
`;

export const Checkbox: FC<CheckboxProps> = ({
  children,
  className,
  style,
  ...props
}) => {
  const { name } = props;

  const context = useContext(CheckboxGroupContext);

  const onChange = (e: CheckboxChangeEvent) => {
    if (props.onChange) {
      props.onChange(e);
    }

    if (context?.onChange) {
      context.onChange(e);
    }
  };

  const inputProps: CheckboxProps = { ...props };

  if (context) {
    inputProps.onChange = onChange;
    inputProps.checked = (context.value || []).includes(name);
    inputProps.disabled = props.disabled || context.disabled;
  }

  const icon = (
    <i>
      <Icon icon="BsCheck" />
    </i>
  );

  const inputName = name || `input-${Math.random()}`;

  return (
    <Container
      className={className || ''}
      style={style || {}}
      htmlFor={inputName}
    >
      <input type="checkbox" id={inputName} {...inputProps} />
      {icon}
      <Label className="label">{children || null}</Label>
    </Container>
  );
};
