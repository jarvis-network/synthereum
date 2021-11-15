import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { AnyAction } from 'redux';
import { Web3ReactProvider, useWeb3React } from '@web3-react/core';
import { InjectedConnector } from '@web3-react/injected-connector';
import { WalletConnectConnector } from '@web3-react/walletconnect-connector';
import { WalletLinkConnector } from '@web3-react/walletlink-connector';
import { LedgerConnector } from '@web3-react/ledger-connector';
import Web3 from 'web3';
import type { provider as Provider } from 'web3-core';
import { getInfuraEndpoint } from '@jarvis-network/core-utils/dist/apis/infura';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';
import { noop } from '@jarvis-network/ui';

import { supportedNetworkIds } from './env';

export type LogoutAction = () => AnyAction;

const supportedChainIds = (supportedNetworkIds as unknown) as number[];

const injected = new InjectedConnector({ supportedChainIds });

const mainnetRPCURL = getInfuraEndpoint(
  Network.mainnet,
  'https',
  process.env.NEXT_PUBLIC_INFURA_API_KEY,
);

const kovanRPCURL = getInfuraEndpoint(
  Network.kovan,
  'https',
  process.env.NEXT_PUBLIC_INFURA_API_KEY,
);

const polygonRPCURL = getInfuraEndpoint(
  Network.polygon,
  'https',
  process.env.NEXT_PUBLIC_INFURA_API_KEY,
);

const mumbaiRPCURL = getInfuraEndpoint(
  Network.mumbai,
  'https',
  process.env.NEXT_PUBLIC_INFURA_API_KEY,
);

const walletconnect = new WalletConnectConnector({
  rpc: {
    [Network.mainnet]: mainnetRPCURL,
    [Network.kovan]: kovanRPCURL,
    [Network.polygon]: polygonRPCURL,
    [Network.mumbai]: mumbaiRPCURL,
  },
  bridge: 'https://bridge.walletconnect.org',
  qrcode: true,
  supportedChainIds,
});

// WalletLink supports multiple networks but WalletLinkConnector doesn't support multipl RPC URLs like WalletConnectConnector
export const walletlink = new WalletLinkConnector({
  url: mainnetRPCURL,
  appName: 'Jarvis Exchange',
  supportedChainIds: [1],
  // TODO: appLogoUrl:
});

export const ledger = new LedgerConnector({
  chainId: 1,
  url: mainnetRPCURL,
  pollingInterval: 12000,
  baseDerivationPath: "44'/60'/0'/0",
});

const connectors = {
  injected,
  walletconnect,
  walletlink,
  ledger,
} as const;

export type Connectors = typeof connectors;

export const weakMapConnectors = new WeakMap<
  Connectors[keyof Connectors],
  string
>();

for (const i in connectors) {
  if (!Object.prototype.hasOwnProperty.call(connectors, i)) continue;

  weakMapConnectors.set(connectors[i as keyof Connectors], i);
}

interface Auth {
  login(wallet: keyof typeof connectors): Promise<void>;
  logout(): void;
}

type Web3ReactHookResult = ReturnType<typeof useWeb3React>;
type Web3ReactActivate = Web3ReactHookResult['activate'];
type Web3ReactDeactivate = Web3ReactHookResult['deactivate'];
type Web3ReactConnector = Web3ReactHookResult['connector'];

function authFactory(
  activate: Web3ReactActivate,
  deactivate: Web3ReactDeactivate,
  connector: Web3ReactConnector,
): Auth {
  return {
    login(wallet) {
      return activate(connectors[wallet]);
    },
    logout() {
      if (connector instanceof WalletLinkConnector) {
        // eslint-disable-next-line no-underscore-dangle
        connector.walletLink._relay.ui.reloadUI = noop; // For some reason this function reloads the page and is being called a second after `connector.close`. You can't connect with a different Coinbase Wallet without refreshing the page.
      }
      if (connector && typeof (connector as any).close === 'function') {
        (connector as any).close();
      }
      deactivate();
      localStorage.removeItem('jarvis/auto-login');
    },
  };
}

const AuthContext = createContext<Auth | null>(null);

interface Props {
  children: ReactNode;
}
export function AuthProvider(props: Props): JSX.Element {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <AuthContextProvider {...props} />
    </Web3ReactProvider>
  );
}

export function AuthContextProvider({ children }: Props): JSX.Element {
  const { activate, deactivate, connector } = useWeb3React();

  const value = useMemo(() => authFactory(activate, deactivate, connector), [
    activate,
    deactivate,
    connector,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error(
      'AuthContext not provided. Use `AuthProvider` from `@jarvis-network/app-toolkit`.',
    );
  return context;
}

function getLibrary(provider: Provider) {
  return new Web3(provider);
}
