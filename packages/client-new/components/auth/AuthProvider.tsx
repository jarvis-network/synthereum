import React, { createContext, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Onboard from 'bnc-onboard';
import Web3 from 'web3';
import { API } from 'bnc-onboard/dist/src/interfaces';

import { setLoginState } from '@/state/slices/auth';
import ENSHelper from '@/utils/ens';

interface AuthMethods {
  login: (wallet?: string) => Promise<boolean>;
  logout: () => void;
}

const OnboardContext = createContext<API>(null);
const Web3Context = createContext<Web3>(null);
const AuthContext = createContext<AuthMethods>(null);
const ENSContext = createContext<ENSHelper>(null);

const NETWORK_ID = 42;
const ONBOARD_API_KEY = process.env.NEXT_PUBLIC_ONBOARD_API_KEY;

const AuthProvider: React.FC = ({ children }) => {
  const [ens, setEns] = useState<ENSHelper>();
  const [web3, setWeb3] = useState<Web3>();
  const [onboard, setOnboard] = useState<API>();
  const [auth, setAuth] = useState<AuthMethods>();

  const dispatch = useDispatch();

  useEffect(() => {
    const onboardInstance = Onboard({
      dappId: ONBOARD_API_KEY,
      networkId: NETWORK_ID,
      subscriptions: {
        wallet: wallet => {
          const web3instance = new Web3(wallet.provider);
          setWeb3(web3instance);
          const ensInstance = new ENSHelper(web3instance);
          setEns(ensInstance);
        },
      },
    });
    setOnboard(onboardInstance);
  }, []);

  useEffect(() => {
    if (!onboard) {
      return;
    }

    setAuth({
      async login(wallet) {
        const select = await onboard.walletSelect(wallet);
        if (!select) {
          return false;
        }
        const check = await onboard.walletCheck();
        if (check) {
          const onboardState = onboard.getState();
          localStorage.setItem('jarvis/autologin', onboardState.wallet.name);

          const state = { ...onboardState };
          delete state.wallet;
          dispatch(setLoginState(state));
        }
        return check;
      },
      logout() {
        onboard.walletReset();
        const state = { ...onboard.getState() };
        delete state.wallet;
        localStorage.removeItem('jarvis/autologin');

        dispatch(setLoginState(state));
      },
    });
  }, [onboard]);

  if (!auth) {
    // wait for instances to be ready before rendering anything that may depend
    // on them
    return null;
  }

  return (
    <OnboardContext.Provider value={onboard}>
      <Web3Context.Provider value={web3}>
        <ENSContext.Provider value={ens}>
          <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
        </ENSContext.Provider>
      </Web3Context.Provider>
    </OnboardContext.Provider>
  );
};

export default AuthProvider;

export { OnboardContext, Web3Context, AuthContext, ENSContext };
