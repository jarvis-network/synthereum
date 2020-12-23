import React from 'react';
import { useWindowSize } from '@jarvis-network/ui';

export const OnDesktop: React.FC = props => {
  const { innerWidth } = useWindowSize();

  if (innerWidth > 1080) {
    return <>{props.children}</>;
  }
  return null;
};
