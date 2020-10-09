import React from "react";
import { useSelector } from 'react-redux'
import { ThemeProvider} from "@jarvis-network/ui";

import {State} from "state/initialState";

const AppThemeProvider = (props) => {
  const theme = useSelector((state: State) => state.theme)

  return (
    <ThemeProvider theme={theme}>
      {props.children}
    </ThemeProvider>
  );
};

export default AppThemeProvider;
