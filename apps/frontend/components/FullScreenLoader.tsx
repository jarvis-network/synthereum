import React from 'react';
import { Loader } from '@/components/Loader';
import { styled } from '@jarvis-network/ui';
import { useReduxSelector } from '@/state/useReduxSelector';

const Container = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
`;

export const FullScreenLoader: React.FC = () => {
  const show = useReduxSelector(state => state.app.isFullScreenLoaderVisible);
  if (!show) {
    return null;
  }

  return (
    <Container>
      <Loader />
    </Container>
  );
};
