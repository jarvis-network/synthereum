import React, { FC } from 'react';

import { styled, ThemeConfig } from '../Theme';

import { ColoredBorderPanelProps, SizeConfig, Size, Color } from './types';

const padding = (size: Size) => `
  box-sizing: border-box;
  padding: ${SizeConfig[size] / 2}px;
`;

const borderRadius = (size: Size, theme: ThemeConfig) => {
  if (size === 'large') {
    return theme.borderRadius.l;
  }

  if (size === 'small') {
    return theme.borderRadius.s;
  }

  return theme.borderRadius.m;
};

const Container = styled.div<{ size: Size; color?: Color }>`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  width: 100%;
  border-left: 9px solid
    ${props =>
      props.color
        ? props.theme.common[props.color]
        : props.theme.border.primary};
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
  box-shadow: ${props => props.theme.shadow.base};
  border-radius: ${props => borderRadius(props.size, props.theme)};

  &,
  & > * {
    ${props => padding(props.size)};
  }
`;

const HeaderContainer = styled.header``;

const FooterContainer = styled.footer``;

const ContentContainer = styled.div``;

export const ColoredBorderPanel: FC<ColoredBorderPanelProps> = ({
  children,
  header,
  footer,
  size = 'normal',
  color,
}) => {
  return (
    <Container size={size} color={color}>
      {header && <HeaderContainer>{header}</HeaderContainer>}
      <ContentContainer>{children}</ContentContainer>
      {footer && <FooterContainer>{footer}</FooterContainer>}
    </Container>
  );
};
