import React, { CSSProperties } from 'react';
import { styled } from '@jarvis-network/ui';

interface LoaderProps {
  size?: 's' | 'm' | 'l';
  color?: CSSProperties['color'];
}

const SizeMap = {
  s: 36,
  m: 50,
  l: 64,
} as const;

const Container = styled.div<LoaderProps>`
  width: auto;
  height: ${props => SizeMap[props.size || 'm']}px;

  svg {
    animation: rotate 1s linear infinite;
    width: ${props => SizeMap[props.size || 'm']}px;
    height: ${props => SizeMap[props.size || 'm']}px;
    position: relative;
  }

  svg circle {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
    animation: dash 1.5s ease-in-out infinite;
    stroke-linecap: round;
    stroke: ${props => props.color || 'white'};
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
  @keyframes dash {
    0% {
      stroke-dasharray: 1, 200;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 89, 200;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 89, 200;
      stroke-dashoffset: -124;
    }
  }
`;

export const Loader: React.FC<LoaderProps> = props => (
  <Container {...props}>
    <svg viewBox="25 25 50 50">
      <circle
        cx="50"
        cy="50"
        r="20"
        fill="none"
        strokeWidth="2"
        strokeMiterlimit="10"
      />
    </svg>
  </Container>
);
