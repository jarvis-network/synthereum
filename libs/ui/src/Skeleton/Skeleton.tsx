import React, { FC } from 'react';

import { styled } from '../Theme';

import { SkeletonProps, SkeletonVisibility } from './types';

const Container = styled.div<SkeletonVisibility>`
  width: 100%;
  height: 100%;
  display: block;

  background: ${props =>
    props.isVisible
      ? `
    ${props.theme.background.primary};
  `
      : `
    linear-gradient(
      to right,
      ${props.theme.background.primary},
      ${props.theme.background.secondary},
      ${props.theme.background.primary}
    ),
    ${props.theme.background.primary};
  `}

  background-repeat: repeat-y;
  background-size: 200px 100%;
  background-position: -20% 0;

  animation: ${props =>
    props.isVisible ? 'none' : 'shine 6s ease-out infinite'};

  @keyframes shine {
    50% {
      background-position: 120% 0;
    }
    100% {
      background-position: -20% 0;
    }
  }
`;

const Content = styled.div<SkeletonVisibility>`
  width: 100%;
  height: 100%;
  transition: opacity 0.2s ease-in;
  opacity: ${props => Number(props.isVisible)};
`;

export const Skeleton: FC<SkeletonProps> = ({ children, style }) => {
  const hasContent = Boolean(children);

  return (
    <Container isVisible={hasContent} style={style || {}}>
      <Content isVisible={hasContent}>{children}</Content>
    </Container>
  );
};
