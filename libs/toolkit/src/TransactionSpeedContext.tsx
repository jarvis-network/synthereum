import { Network } from '@jarvis-network/core-utils/dist/eth/networks';
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

const oneGwei = 1000 * 1000 * 1000;

class MainnetGasProvider {
  private timeoutId = 0;

  private connection?: WebSocket;

  constructor(
    private setState: (value: {
      networkId: number;
      value: Context | null;
    }) => void,
  ) {
    this.connect();
  }

  private setTimeout() {
    this.timeoutId = (setTimeout(this.reconnect) as unknown,
    20 * 1000) as number;
  }

  private connect() {
    this.connection = new WebSocket('wss://www.gasnow.org/ws');
    this.connection.addEventListener('open', this.setTimeout);
    this.connection.addEventListener('message', event => {
      const data = JSON.parse(event.data) as {
        data: {
          gasPrices: {
            fast: number;
            rapid: number;
            slow: number;
            standard: number;
          };
        };
        type: 'gasprice';
      };

      if (data.type === 'gasprice') {
        this.setState({
          networkId: Network.mainnet,
          value: {
            fast: Math.floor(data.data.gasPrices.fast / oneGwei),
            rapid: Math.floor(data.data.gasPrices.rapid / oneGwei),
            standard: Math.floor(data.data.gasPrices.standard / oneGwei),
          },
        });

        clearTimeout(this.timeoutId);
        this.setTimeout();
      }
    });
    this.connection.addEventListener('close', this.closeHandler);
    this.connection.addEventListener('error', this.closeHandler);
  }

  private closeHandler = () => {
    clearTimeout(this.timeoutId);
    setTimeout(() => {
      this.connect();
    }, 1000);
  };

  private reconnect = () => {
    if (this.connection) {
      this.connection.removeEventListener('close', this.closeHandler);
      this.connection.removeEventListener('error', this.closeHandler);
      this.connection.close();
    }
    this.connect();
  };

  destroy() {
    clearTimeout(this.timeoutId);
    if (this.connection) {
      this.connection.removeEventListener('close', this.closeHandler);
      this.connection.removeEventListener('error', this.closeHandler);
      this.connection.close();
    }
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
      const provider = new MainnetGasProvider(setState);
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
      setState({
        networkId: Network.polygon,
        value: { standard: 1, fast: 1, rapid: 5 },
      });
      return;
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
