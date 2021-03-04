import { createContext, useContext } from 'react';
import type Onboard from 'bnc-onboard';
import type { BehaviorSubject } from 'rxjs';
import type Web3 from 'web3';
import type { RealmAgent } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';
import type { ENSHelper } from './ens';

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

export function useCoreObservables() {
  const value = useContext(CoreObservablesContext);
  if (!value) throw new Error('CoreObservablesContext not provided');
  return value;
}
