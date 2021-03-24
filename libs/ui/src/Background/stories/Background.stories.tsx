import React from 'react';

import { Background } from '../Background';
import { images } from '../../AnimatedBackground/stories/assets';
import { styled } from '../../Theme';

export default {
  title: 'background/Background',
  component: Background,
};

const Container = styled.div`
  height: 500px;
  width: 500px;
`;

export const BasicBackground = () => (
  <Container>
    <Background image={images['./desert_background.svg']} />
  </Container>
);
