import React, { createContext, useState, useEffect} from "react";
import { useDispatch } from 'react-redux'
import Onboard from "bnc-onboard";
import Web3 from "web3";
import {API} from "bnc-onboard/dist/src/interfaces";
import {setLoginState} from "../../state/slices/auth";

const OnboardContext = createContext(null);
const Web3Context = createContext(null);
const AuthContext = createContext(null);

const NETWORK_ID = 42;
const ONBOARD_API_KEY = process.env.NEXT_PUBLIC_ONBOARD_API_KEY;

interface AuthMethods {
  login: (wallet?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthProvider: React.FC<{}> = ({ children }) => {
  const [web3, setWeb3] = useState<Web3>();
  const [onboard, setOnboard] = useState<API>();
  const [login, setLogin] = useState<AuthMethods>();

  const dispatch = useDispatch();

  useEffect(() => {
    const onboard = Onboard({
      dappId: ONBOARD_API_KEY,
      networkId: NETWORK_ID,
      subscriptions: {
        wallet: wallet => {
          setWeb3(new Web3(wallet.provider));
        }
      }
    });
    setOnboard(onboard);
  }, [])

  useEffect(() => {
    setLogin({
      async login(wallet) {
        const select = await onboard.walletSelect(wallet);
        if (!select) {
          return false;
        }
        const check = await onboard.walletCheck();
        if (check) {
          const onboardState = onboard.getState()
          localStorage.setItem("jarvis/autologin", onboardState.wallet.name);

          const state = { ...onboardState };
          delete state.wallet;
          dispatch(setLoginState(state))
        }
        return check;
      },
      logout() {
        onboard.walletReset();
        const state = { ... onboard.getState() }
        delete state.wallet;

        dispatch(setLoginState(state))
      }
    })
  }, [onboard])

  return (
    <OnboardContext.Provider value={onboard}>
      <Web3Context.Provider value={web3}>
        <AuthContext.Provider value={login}>
          {children}
        </AuthContext.Provider>
      </Web3Context.Provider>
    </OnboardContext.Provider>
  )
};

export default AuthProvider

export {
  OnboardContext,
  Web3Context,
  AuthContext,
}
