import React, { ReactNode, useEffect, useState } from 'react';

import { styled } from '../../Theme';

import { Skeleton } from '..';

export default {
  title: 'Skeleton',
  component: Skeleton,
};

const Container = styled.div`
  width: 400px;
  height: 300px;
  border-radius: 30px;
`;

const Wrapper = styled(Container)`
  border: 10px solid ${props => props.theme.border.secondary};
  background: 10px solid ${props => props.theme.background.secondary};
`;

const Content = styled(Container)`
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const Default = () => {
  const [content, setContent] = useState<ReactNode | null>(null);

  useEffect(() => {
    setTimeout(() => setContent(<Content>Hello world</Content>), 2000);
  }, []);

  // Skeleton renders loader if no children content provided
  // When content appears component will start transition and will display it

  return (
    <Wrapper>
      <Skeleton style={{ borderRadius: 30 }}>{content}</Skeleton>
    </Wrapper>
  );
};
