import { assertIsString } from '@jarvis-network/core-utils/dist/base/asserts';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';
import { noop } from '@jarvis-network/ui';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { useWeb3 } from './auth/useWeb3';

interface Value {
  standard: number;
  fast: number;
  rapid: number;
}

type Context = React.MutableRefObject<Value | null>;
const context = createContext<Context>({
  current: null,
});

class EtherscanGasProvider {
  private intervalId = 0;

  constructor(
    domain: 'etherscan.io' | 'polygonscan.com',
    apiKey: string,
    private update: (value: Value) => void,
  ) {
    assertIsString(apiKey, 34);
    if (typeof window !== 'object') return;

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
            this.update({ fast, rapid, standard });
          },
        );
    };

    callback();

    this.intervalId = window.setInterval(callback, interval * 1000);
  }

  destroy() {
    this.update = noop;
    clearInterval(this.intervalId);
  }
}

export function TransactionSpeedProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { chainId: networkId } = useWeb3();
  const ref = useRef<Value | null>(null);

  useEffect(() => {
    if (!networkId) {
      ref.current = null;
      return;
    }

    function update(value: Value) {
      ref.current = value;
    }

    if (networkId === Network.mainnet) {
      const provider = new EtherscanGasProvider(
        'etherscan.io',
        process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY as string,
        update,
      );
      return () => {
        provider.destroy();
        ref.current = null;
      };
    }
    if (networkId === Network.kovan) {
      ref.current = { standard: 2, fast: 4, rapid: 10 };
      return () => {
        ref.current = null;
      };
    }
    if (networkId === Network.polygon) {
      const provider = new EtherscanGasProvider(
        'polygonscan.com',
        process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY as string,
        update,
      );
      return () => {
        provider.destroy();
        ref.current = null;
      };
    }
    if (networkId === Network.mumbai) {
      ref.current = { standard: 1, fast: 1, rapid: 5 };
      return () => {
        ref.current = null;
      };
    }

    return undefined;
  }, [networkId]);

  return <context.Provider value={ref}>{children}</context.Provider>;
}

export function useTransactionSpeedContext(): Context {
  return useContext(context);
}
