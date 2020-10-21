import React, {useContext, useEffect} from "react";
import { useSelector, useDispatch } from "react-redux";
import {AccountDropdown} from "@jarvis-network/ui";

import SignInUpButton from "components/header/SignInUpButton";
import {AuthContext} from "components/auth/AuthProvider";
import {State} from "state/initialState";
import { setTheme } from "state/slices/theme";
import avatar from "utils/avatar";
import usePrettyName from "utils/usePrettyName";

const noop = () => undefined;

const cutWalletAddress = (address: string) => {
  const start = address.substr(0, 6);
  const end = address.substr(address.length - 4);

  return `${start}...${end}`;
}

const render = () => {
  const dispatch = useDispatch();
  const auth = useSelector((state: State) => state.auth);
  const authLogin = useContext(AuthContext)
  const name = usePrettyName(auth.address)

  const logIn = async () => {
    await authLogin.login();
  };

  useEffect(() => {
    let autoLoginWallet = localStorage.getItem("jarvis/autologin");
    if (autoLoginWallet) {
      authLogin.login(autoLoginWallet).catch(noop);
    }
  }, [])

  const handleSetTheme = (theme) => {
    dispatch(setTheme({ theme }))
  }

  const links = [
    {
      name: "Account",
      key: "Account",
      onClick: () => alert("Account")
    },
    {
      name: "Activity",
      key: "Activity",
      onClick: () => alert("Activity")
    },
    {
      name: "Help",
      key: "Help",
      onClick: () => alert("Help")
    },
  ];

  if (auth.address) {
    const addr = cutWalletAddress(auth.address)
    return (
      <AccountDropdown
        width={"195px"}
        links={links}
        position={"absolute"}
        name={name || ""}
        wallet={addr}
        onLogout={authLogin.logout}
        onModeChange={() => null}
        onThemeChange={handleSetTheme}
        mode={"demo"}
        image={avatar(auth.address)}
      />
    )
  }
  return <SignInUpButton onClick={logIn} />
};

const rightRenderer = { render };
export default rightRenderer;
