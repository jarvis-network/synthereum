import React from 'react';
import { motion } from 'framer-motion';
import { styled } from '@jarvis-network/ui';

const Circle = styled(motion.div)`
  width: 20px;
  height: 20px;
  border-radius: 20px;
  opacity: 1;
  margin: 4px;
  display: inline-block;
  background: #4efa74;
}`;

const variants = {
  start: {
    scale: 0.2,
  },
  end: {
    scale: 1,
  },
};
const LoadingContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: center;
  align-content: stretch;
  align-items: center;
  height: 100%;
`;
export const Loader = () => (
  <LoadingContainer>
    <Circle
      variants={variants}
      initial="start"
      animate="end"
      transition={{
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'anticipate',
        duration: 1,
        delay: 0,
      }}
    />
    <Circle
      variants={variants}
      initial="start"
      animate="end"
      transition={{
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'anticipate',
        duration: 1,
        delay: 0.2,
      }}
    />
    <Circle
      variants={variants}
      initial="start"
      animate="end"
      transition={{
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'anticipate',
        duration: 1,
        delay: 0.4,
      }}
    />
  </LoadingContainer>
);
