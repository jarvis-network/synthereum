import React, { createContext, useContext } from 'react';
import { BehaviorSubject } from 'rxjs';
import type { RealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realm-agent';
import type { SelfMintingRealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/agent';

import { useConstant } from './useConstant';

type Context = {
  synthereumRealmAgent$: BehaviorSubject<RealmAgent | null>;
  selfMintingRealmAgent$: BehaviorSubject<SelfMintingRealmAgent | null>;
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
    synthereumRealmAgent$: new BehaviorSubject<RealmAgent | null>(null),
    selfMintingRealmAgent$: new BehaviorSubject<SelfMintingRealmAgent | null>(
      null,
    ),
  }));
}
