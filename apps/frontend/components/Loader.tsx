import React from 'react';
import { styled } from '@jarvis-network/ui';

const Container = styled.div`
  svg {
    animation: rotate 1s linear infinite;
    width: 50px;
    height: 50px;
    position: relative;
  }

  svg circle {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
    animation: dash 1.5s ease-in-out infinite;
    stroke-linecap: round;
    stroke: white;
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

export const Loader: React.FC = () => {
  return (
    <Container>
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
};
