import React from 'react';

import { ButtonProps, ButtonDesignProps, ButtonModifierProps } from '../types';

import { styled } from '../../Theme';

import { getButtonStyles } from './common';

export const StandardButtonContainer = styled.button<ButtonModifierProps>(
  props => getButtonStyles(props, props.theme),
);

interface StandardButtonProps extends ButtonProps, ButtonDesignProps {}

const StandardButton: React.FC<StandardButtonProps> = ({
  children,
  type,
  ...props
}) => (
  <StandardButtonContainer type="button" buttonType={type} {...props}>
    {children}
  </StandardButtonContainer>
);

export default StandardButton;
