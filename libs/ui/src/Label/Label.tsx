import React from 'react';

import { styled } from '../Theme';

export interface LabelProps {
  className?: string;
}

const LabelContainer = styled.span`
  font-size: ${props => props.theme.font.sizes.l};
  font-weight: bold;
`;

export const Label: React.FC<LabelProps> = ({
  children,
  className,
  ...props
}) => (
  <LabelContainer className={className || ''} {...props}>
    {children}
  </LabelContainer>
);
