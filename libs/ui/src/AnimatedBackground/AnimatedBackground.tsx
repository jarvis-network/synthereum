import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { styled } from '../Theme';

import { useWindowSize } from '../hooks/useWindowSize';

import { useBackground } from './BackgroundProvider';

export interface IBackgroundProps {
  url: string;
  offset?: string;
  bgColor?: string;
  animate?: boolean;
  // Check https://css-tricks.com/the-trick-to-viewport-units-on-mobile/ for
  // why using simply 100vh doesn't work on mobile browsers.
  updateHeight?: 'on-mount-only' | 'on-resize' | 'fixed-100vh';
  centerContent?: boolean;
}

const Wrapper = styled.div`
  transform: translate3d(0, 0, 0);
`;

const Container = styled(motion.div)`
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  display: block;
  min-height: 100%;
  min-width: 100%;
  position: fixed;
  z-index: 0;
`;

export const AnimatedBackground: React.FC<IBackgroundProps> = ({
  url,
  offset = '0',
  bgColor = '#ffffff',
  animate = true,
  updateHeight = 'on-mount-only',
  centerContent = false,
  children,
}) => {
  const { offset: hookOffset, setOffset } = useBackground();
  const { innerHeight } = useWindowSize();
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (offset) {
      setOffset(offset);
    }
  }, [offset]);

  useEffect(() => {
    switch (updateHeight) {
      case 'on-mount-only':
        if (height === null) setHeight(innerHeight);
        break;
      case 'on-resize':
        setHeight(innerHeight);
        break;
      case 'fixed-100vh':
        break;
      default:
        throw Error(`Unsupported option: '${updateHeight}'`);
    }
  }, [innerHeight, updateHeight]);

  return (
    <Wrapper
      style={{
        background: bgColor,
        height:
          updateHeight === 'fixed-100vh'
            ? '100vh'
            : height
            ? `${height}px`
            : '100vh',
      }}
    >
      <Container
        style={{ backgroundImage: `url(${url})` }}
        initial={{ y: animate ? '0%' : offset }}
        animate={{
          y: hookOffset,
          transition: animate
            ? {
                type: 'spring',
                damping: 10,
                stiffness: 150,
              }
            : {
                type: 'just',
              },
        }}
      />
      {children && (
        <div
          style={{
            position: 'fixed',
            width: '100%',
            height: '100%',
            ...(centerContent
              ? {
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }
              : {}),
          }}
        >
          {children}
        </div>
      )}
    </Wrapper>
  );
};
