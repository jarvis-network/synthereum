import React, { FC } from 'react';

import { AllButtonProps, ButtonModifierProps } from '../types';

import { styled } from '../../Theme';

import { getButtonStyles } from './common';

interface LinkButtonProps extends AllButtonProps {
  href: string;
}

/**
 * Wrap anchor to accept button modified props like rounded or inverted to pass them into styled
 */
// eslint-disable-next-line jsx-a11y/anchor-has-content
const CustomLink: FC<ButtonModifierProps> = props => <a {...props} />;

export const LinkButtonContainer = styled(CustomLink)(props =>
  getButtonStyles(props, props.theme),
);

const LinkButton: React.FC<LinkButtonProps> = ({ type, ...props }) => (
  <LinkButtonContainer buttonType={type} {...props} />
);

export default LinkButton;
