import { assertIsString } from '@jarvis-network/core-utils/dist/base/asserts';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';
import { noop } from '@jarvis-network/ui';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useWeb3 } from './auth/useWeb3';

interface Context {
  standard: number;
  fast: number;
  rapid: number;
}
const context = createContext<Context | null>(null);

class EtherscanGasProvider {
  private intervalId = 0;

  constructor(
    domain: 'etherscan.io' | 'polygonscan.com',
    apiKey: string,
    private setState: (value: {
      networkId: number;
      value: Context | null;
    }) => void,
  ) {
    assertIsString(apiKey, 34);
    if (typeof window !== 'object') return;

    const networkId =
      domain === 'etherscan.io' ? Network.mainnet : Network.polygon;
    const interval = domain === 'etherscan.io' ? 10 : 3;

    const callback = () => {
      fetch(
        `https://api.${domain}/api?module=gastracker&action=gasoracle&apikey=${apiKey}`,
      )
        .then(response => response.json())
        .then(
          (data: {
            status: string;
            message: 'OK';
            result: {
              LastBlock: string;
              SafeGasPrice: string;
              ProposeGasPrice: string;
              FastGasPrice: string;
              UsdPrice: string;
            };
          }) => {
            const fast = Number(data.result.ProposeGasPrice);
            const rapid = Number(data.result.FastGasPrice);
            const standard = Number(data.result.SafeGasPrice);
            if (!fast || !rapid || !standard) return;
            this.setState({ networkId, value: { fast, rapid, standard } });
          },
        );
    };

    callback();

    this.intervalId = window.setInterval(callback, interval * 1000);
  }

  destroy() {
    this.setState = noop;
    clearInterval(this.intervalId);
  }
}

export function TransactionSpeedProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { chainId: networkId } = useWeb3();
  const [state, setState] = useState<{
    networkId: number;
    value: Context | null;
  }>(() => ({ networkId: 0, value: null }));

  /* eslint-disable no-useless-return */
  useEffect(() => {
    if (!networkId) return;

    if (networkId === Network.mainnet) {
      const provider = new EtherscanGasProvider(
        'etherscan.io',
        process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY as string,
        setState,
      );
      return () => provider.destroy();
    }
    if (networkId === Network.kovan) {
      setState({
        networkId: Network.kovan,
        value: { standard: 2, fast: 4, rapid: 10 },
      });
      return;
    }
    if (networkId === Network.polygon) {
      const provider = new EtherscanGasProvider(
        'polygonscan.com',
        process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY as string,
        setState,
      );
      return () => provider.destroy();
    }
    if (networkId === Network.mumbai) {
      setState({
        networkId: Network.mumbai,
        value: { standard: 1, fast: 1, rapid: 5 },
      });
      return;
    }

    return;
  }, [networkId, setState]);
  /* eslint-enable no-useless-return */

  return (
    <context.Provider
      value={networkId && networkId === state.networkId ? state.value : null}
    >
      {children}
    </context.Provider>
  );
}

export function useTransactionSpeed(): Context | null {
  return useContext(context);
}
