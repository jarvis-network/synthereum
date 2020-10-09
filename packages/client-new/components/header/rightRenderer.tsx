import React from "react";
import { useSelector, useDispatch } from 'react-redux'
import {AccountButton, styled} from "@jarvis-network/ui";

import SignInUpButton from "components/header/SignInUpButton";
import {State} from "state/initialState";
import { setLoginState } from "state/slices/auth";

const CustomAccountButton = styled(AccountButton)`
  width: 320px;
`

const render = () => {
  const auth = useSelector((state: State) => state.auth );
  const dispatch = useDispatch();

  const simulateLogin = async () => {
    dispatch(setLoginState({ state: true }))
  };

  if (auth.state) {
    return <CustomAccountButton name={"john doe"} wallet={"0x1234...0def"} />
  }
  return <SignInUpButton onClick={simulateLogin} />
};

const rightRenderer = { render };
export default rightRenderer;
