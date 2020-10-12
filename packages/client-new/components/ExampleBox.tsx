import React from "react";
import {styled, Tabs} from "@jarvis-network/ui";
import { useSelector, useDispatch } from 'react-redux'

import {State} from "state/initialState";
import {setTheme} from "state/slices/theme";

const tabs = [
  {
    title: "Exchange",
  },
]

const mainContentBackground = {
  night: "#2e3541",
  dark: "#292929",
  light: "#fff",
}

const Container = styled.div`
  width: 500px;
  box-shadow: ${props => props.theme.shadow.base};
  height: 500px;
  position: relative;
  top: calc(118px - 50px);
  left: 150px;
`;

const ExampleBox = () => {
  const dispatch = useDispatch();
  const theme = useSelector((state: State) => state.theme);

  const boxStyle = {
    background: mainContentBackground[theme]
  }

  const handleSetTheme = (theme) => {
    dispatch(setTheme({ theme }))
  }

  return (
    <Container style={boxStyle}>
      <Tabs tabs={tabs} selected={0} />

      <div>
        <button onClick={handleSetTheme.bind(null, "dark")}>Set dark mode</button>
        <button onClick={handleSetTheme.bind(null, "night")}>Set night mode</button>
        <button onClick={handleSetTheme.bind(null, "light")}>Set light mode</button>
      </div>
    </Container>
  );
};

export default ExampleBox;
