import React, { FC } from 'react';
import { Link, LinkProps } from 'react-router-dom';

import { AllButtonProps, ButtonModifierProps } from '../types';

import { styled } from '../../Theme';

import { getButtonStyles } from './common';

interface LinkButtonProps extends AllButtonProps {
  to: string;
}

interface CustomLinkProps extends LinkProps, ButtonModifierProps {}

/**
 * Wrap router's Link component to accelt button modified props like rounded or inverted to pass them into styled
 */
const CustomLink: FC<CustomLinkProps> = props => <Link {...props} />;

export const LinkButtonContainer = styled(CustomLink)(props =>
  getButtonStyles(props, props.theme),
);

const LinkButton: React.FC<LinkButtonProps> = ({ type, ...props }) => (
  <LinkButtonContainer buttonType={type} {...props} />
);

export default LinkButton;
