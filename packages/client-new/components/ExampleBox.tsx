import React from 'react';
import { styled, Tabs } from '@jarvis-network/ui';
import { useSelector } from 'react-redux';

import { State } from '@/state/initialState';

const tabs = [
  {
    title: 'Exchange',
  },
];

const mainContentBackground = {
  night: '#2e3541',
  dark: '#292929',
  light: '#fff',
};

const Container = styled.div`
  width: 500px;
  box-shadow: ${props => props.theme.shadow.base};
  height: 500px;
  position: relative;
  top: calc(118px - 50px);
  left: 150px;
`;

const ExampleBox = () => {
  const theme = useSelector((state: State) => state.theme);

  const boxStyle = {
    background: mainContentBackground[theme],
  };

  return (
    <Container style={boxStyle}>
      <Tabs tabs={tabs} selected={0} />
    </Container>
  );
};

export default ExampleBox;
