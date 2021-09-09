import React, { CSSProperties } from 'react';

import { styled } from '../Theme';

import { TooltipProps, TooltipPositionType } from './types';

const Container = styled.div`
  display: inline-block;
  position: relative;

  & .children:hover + .tooltip {
    visibility: visible;
  }
`;

const ChildrenContainer = styled.span`
  display: inline-block;
`;

const getStylesByPosition = (position: TooltipPositionType) => {
  if (position === 'right') {
    return `
      top: 1px;
      left: 110%;
    `;
  }

  if (position === 'left') {
    return `
      top: 1px;
      right: 110%;
    `;
  }

  if (position === 'top') {
    return `
      bottom: 110%;
      left: 1px;
    `;
  }

  return `
    top: 110%;
    right: 1px;
  `;
};

const TooltipContainer = styled.span<{
  position: TooltipPositionType;
  width: CSSProperties['width'];
}>`
  display: inline-block;
  position: absolute;
  visibility: hidden;
  z-index: 1 !important;

  ${props => getStylesByPosition(props.position)}
  width: ${props => props.width};

  padding: 8px 10px;
  font-size: ${props => props.theme.font.sizes.s};
  color: ${props => props.theme.tooltip.text};
  background-color: ${props => props.theme.tooltip.background};
  border-radius: ${props => props.theme.borderRadius.s};
`;

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  tooltip,
  position = 'right',
  width = '250px',
  wrapperClassName,
}) => (
  <Container className={wrapperClassName}>
    <ChildrenContainer className="children">{children}</ChildrenContainer>
    <TooltipContainer className="tooltip" position={position} width={width}>
      {tooltip}
    </TooltipContainer>
  </Container>
);
