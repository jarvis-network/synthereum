import React, { createContext, useContext } from 'react';
import { BehaviorSubject } from 'rxjs';
import type { RealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realm-agent';

import { useConstant } from './useConstant';

type Context = {
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
    realmAgent$: new BehaviorSubject<RealmAgent | null>(null),
  }));
}
