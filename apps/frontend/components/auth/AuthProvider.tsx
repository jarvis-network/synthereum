import React, { createContext, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Onboard from 'bnc-onboard';
import Web3 from 'web3';
import { API } from 'bnc-onboard/dist/src/interfaces';

import { setLoginState } from '@/state/slices/auth';
import { ENSHelper } from '@/utils/ens';
import { getOnboardConfig, NETWORK_ID } from '@/components/auth/onboardConfig';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { RealmAgent } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { useReduxSelector } from '@/state/useReduxSelector';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import {
  parseSupportedNetworkId,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';

interface AuthMethods {
  login: (wallet?: string) => Promise<boolean>;
  logout: () => void;
}

export const OnboardContext = createContext<API | undefined>(undefined);
export const Web3Context = createContext<Web3 | undefined>(undefined);
export const AuthContext = createContext<AuthMethods | undefined>(undefined);
export const ENSContext = createContext<ENSHelper | undefined>(undefined);
export const RealmAgentContext = createContext<RealmAgent | undefined>(
  undefined,
);

export const AuthProvider: React.FC = ({ children }) => {
  const [ens, setEns] = useState<ENSHelper>();
  const [web3, setWeb3] = useState<Web3>();
  const [onboard, setOnboard] = useState<API>();
  const [auth, setAuth] = useState<AuthMethods>();
  const [realmAgent, setRealmAgent] = useState<RealmAgent>();

  const address = useReduxSelector(state => state.auth?.address);

  const dispatch = useDispatch();

  useEffect(() => {
    const onboardInstance = Onboard({
      ...getOnboardConfig(),
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
        const onboardState = onboard.getState();
        if (check && onboardState.wallet.name) {
          const { name } = onboardState.wallet;
          localStorage.setItem('jarvis/autologin', name);
          const { wallet: _, ...state } = onboardState;
          dispatch(setLoginState({ ...state, wallet: name }));
        }
        return check;
      },
      logout() {
        onboard.walletReset();
        const { wallet, ...state } = onboard.getState();
        const { name } = wallet;
        localStorage.removeItem('jarvis/autologin');

        dispatch(setLoginState({ ...state, wallet: name }));
      },
    });
  }, [onboard]);

  useEffect(() => {
    if (!web3 || !address) {
      setRealmAgent(undefined);
      return;
    }

    (async () => {
      const netId = parseSupportedNetworkId(NETWORK_ID);

      const realm = await loadRealm(
        web3 as Web3On<SupportedNetworkName>,
        netId,
      );

      const rlmAgent = new RealmAgent(
        realm,
        address as AddressOn<typeof netId>,
        'v1',
      );
      setRealmAgent(rlmAgent);
    })();
  }, [web3, address]);

  if (!auth) {
    // wait for instances to be ready before rendering anything that may depend
    // on them
    return null;
  }

  return (
    <OnboardContext.Provider value={onboard}>
      <Web3Context.Provider value={web3}>
        <ENSContext.Provider value={ens}>
          <AuthContext.Provider value={auth}>
            <RealmAgentContext.Provider value={realmAgent}>
              {children}
            </RealmAgentContext.Provider>
          </AuthContext.Provider>
        </ENSContext.Provider>
      </Web3Context.Provider>
    </OnboardContext.Provider>
  );
};
