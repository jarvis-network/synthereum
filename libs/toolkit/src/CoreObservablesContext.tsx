import React, { createContext, useContext } from 'react';
import type Onboard from 'bnc-onboard';
import { BehaviorSubject } from 'rxjs';
import type Web3 from 'web3';
import type { RealmAgent } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';

import type { ENSHelper } from './ens';
import { useConstant } from './useConstant';

type Context = {
  onboard$: BehaviorSubject<ReturnType<typeof Onboard> | null>;
  web3$: BehaviorSubject<Web3 | null>;
  ens$: BehaviorSubject<ENSHelper | null>;
  realmAgent$: BehaviorSubject<RealmAgent | null>;
};

const CoreObservablesContext = createContext<Context | null>(null);

export const CoreObservablesContextProvider: React.FC<{ value: Context }> = ({
  value,
  children,
}) => (
  <CoreObservablesContext.Provider value={value}>
    {children}
  </CoreObservablesContext.Provider>
);

export function useCoreObservables(): Context {
  const value = useContext(CoreObservablesContext);
  if (!value) throw new Error('CoreObservablesContext not provided');
  return value;
}

export function useSubjects(): Context {
  return useConstant(() => ({
    web3$: new BehaviorSubject<Web3 | null>(null),
    ens$: new BehaviorSubject<ENSHelper | null>(null),
    onboard$: new BehaviorSubject<ReturnType<typeof Onboard> | null>(null),
    realmAgent$: new BehaviorSubject<RealmAgent | null>(null),
  }));
}
