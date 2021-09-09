import { debounce } from 'lodash';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { BehaviorSubject } from 'rxjs';

import { useWeb3 } from './auth/useWeb3';

const context = createContext<BehaviorSubject<number> | null>(null);

export function BlockNumber$ContextProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { library: web3 } = useWeb3();
  const [value$] = useState(() => new BehaviorSubject<number>(0));

  useEffect(() => {
    if (!web3) return;

    let blockNumberSubscription: { unsubscribe(): void };

    const updateValue = debounce((blockNumber: number) => {
      if (value$.value === blockNumber) return;
      value$.next(blockNumber);
    }, 10);

    const update = () => {
      web3!.eth
        .getBlockNumber()
        .then(blockNumber => {
          updateValue(blockNumber);
        })
        .catch(console.error);
    };
    update();
    const intervalId = setInterval(update, 14 * 1000);
    const clearTimeout = () => {
      clearInterval(intervalId);
    };

    // eslint-disable-next-line no-underscore-dangle
    if ((web3 as any)._requestManager.provider.on) {
      blockNumberSubscription = web3.eth.subscribe(
        'newBlockHeaders',
        (error, blockHeader) => {
          if (error) return console.error(error);
          updateValue(blockHeader.number);
        },
      );
    }

    return () => {
      blockNumberSubscription?.unsubscribe();
      clearTimeout?.();
    };
  }, [web3, value$]);

  return <context.Provider value={value$}>{children}</context.Provider>;
}

export function useBlockNumber$Context(): BehaviorSubject<number> {
  const value = useContext(context);
  if (!value) throw new Error('BlockNumber$Context not provided');
  return value;
}
