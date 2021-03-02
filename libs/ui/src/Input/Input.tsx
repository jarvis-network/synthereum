import React from 'react';

import { styled } from '../Theme';
import { flexRow, flexColumn } from '../common/mixins';

import { InputProps } from './types';

const INPUT_HEIGHT = 65;
const INPUT_PADDING = 15;

const InputContainer = styled.div``;

const InputGroupContainer = styled.div<{ filled: boolean; invalid?: boolean }>`
  ${flexRow()}

  align-items: center;
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: ${props => props.theme.borderRadius.s};
  width: 100%;
  margin-top: 5px;
  margin-bottom: 5px;

  input {
    border: 0;
    color: ${props => props.theme.text.primary};
    background: ${props => props.theme.background.primary};
    font-size: ${props => props.theme.font.sizes.l};
    height: ${INPUT_HEIGHT}px;
    outline: 0;
    padding: 0 ${INPUT_PADDING}px;
    width: 100%;
    border-radius: ${props => props.theme.borderRadius.s};
  }

  .label {
    color: ${props => props.theme.text.medium};
    font-size: ${props => props.theme.font.sizes.l};
    left: ${INPUT_PADDING}px;
    pointer-events: none;
    position: absolute;
    top: ${INPUT_HEIGHT / 3}px;
    transition: 0.2s ease all;
  }

  input:focus ~ .label {
    font-size: ${props => props.theme.font.sizes.xxs};
    top: ${INPUT_HEIGHT / 11}px;
  }

  ${props =>
    props.filled
      ? `
    .label {
      font-size: ${props.theme.font.sizes.xxs};
      top: ${INPUT_HEIGHT / 11}px;
    }
  `
      : ''}

  ${props =>
    props.invalid
      ? `
    border: 1px solid ${props.theme.border.invalid};

    .label {
      color: ${props.theme.text.invalid};
    }
  `
      : ''}
`;

const InputWrapper = styled.div`
  overflow: hidden;
  position: relative;
  width: 100%;
  border-radius: ${props => props.theme.borderRadius.m};

  input::placeholder {
    color: ${props => props.theme.text.secondary};
  }
`;

const InputPrefix = styled.div`
  ${flexColumn()}
  align-items: center;
  height: auto;
  padding-left: ${INPUT_PADDING}px;
`;

const InputSuffix = styled(InputPrefix)`
  padding-left: 0;
  padding-right: ${INPUT_PADDING}px;
`;

const InputInfo = styled.span`
  font-size: ${props => props.theme.font.sizes.s};
  margin-left: ${INPUT_PADDING}px;
  text-transform: uppercase;
`;

export const Input: React.FC<InputProps> = ({
  className,
  info,
  label,
  invalid,
  invalidMessage,
  prefix,
  suffix,
  value,
  ...props
}) => {
  let labelText = label;
  if (invalid && invalidMessage) labelText = invalidMessage;

  return (
    <InputContainer className={className || ''}>
      <InputGroupContainer
        filled={value !== ''}
        invalid={invalid}
        className="group"
      >
        {!!prefix && <InputPrefix>{prefix}</InputPrefix>}
        <InputWrapper>
          <input value={value} {...props} />
          <span className="label">{labelText}</span>
        </InputWrapper>
        {!!suffix && <InputSuffix>{suffix}</InputSuffix>}
      </InputGroupContainer>
      {info && <InputInfo>{info}</InputInfo>}
    </InputContainer>
  );
};
