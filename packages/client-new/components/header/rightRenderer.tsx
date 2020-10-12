import React, {useContext, useEffect} from "react";
import { useSelector } from "react-redux";
import {AccountButton, styled} from "@jarvis-network/ui";

import SignInUpButton from "components/header/SignInUpButton";
import {AuthContext} from "components/auth/AuthProvider";
import {State} from "state/initialState";

const CustomAccountButton = styled(AccountButton)`
  width: 320px;
`

const noop = () => undefined;

const cutWalletAddress = (address: string) => {
  const start = address.substr(0, 6);
  const end = address.substr(address.length - 4);

  return `${start}...${end}`;
}

const render = () => {
  const auth = useSelector((state: State) => state.auth);
  const authLogin = useContext(AuthContext)

  const logIn = async () => {
    await authLogin.login();
  };

  useEffect(() => {
    let autoLoginWallet = localStorage.getItem("jarvis/autologin");
    if (autoLoginWallet) {
      authLogin.login(autoLoginWallet).catch(noop);
    }
  }, [])

  if (auth.address) {
    const addr = cutWalletAddress(auth.address)
    return <CustomAccountButton name={""} wallet={addr} />
  }
  return <SignInUpButton onClick={logIn} />
};

const rightRenderer = { render };
export default rightRenderer;
