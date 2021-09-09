import { useMemo } from 'react';
import {
  configureStore,
  Store,
  getDefaultMiddleware,
  EnhancedStore,
} from '@reduxjs/toolkit';
import type { DeepPartial, Middleware, Reducer } from 'redux';
import { State, initialAppState } from '@/state/initialState';
import { reducer } from '@/state/reducer';
import { createPersistMiddleware } from '@/state/persist';
import { Tagged } from '@jarvis-network/core-utils/dist/base/tagged-type';

let cachedStore: Store | undefined;

function initStore(
  preloadedState: State = initialAppState,
): EnhancedStore<State> {
  type DeepClearTagged<T> = {
    [K in keyof T]: T[K] extends Tagged<infer R, any>
      ? R
      : T[K] extends Record<string, unknown>
      ? DeepClearTagged<T[K]>
      : T[K];
  };

  type NoTaggedState = DeepClearTagged<State>;

  const defaultMiddleware = getDefaultMiddleware<NoTaggedState>();

  const persistMiddleware = createPersistMiddleware<NoTaggedState>([
    'theme',
    'exchange.payAsset',
    'exchange.receiveAsset',
    'exchange.chartDays',
    'exchange.slippage',
    'exchange.deadline',
    'exchange.disableMultihops',
    'exchange.transactionSpeed',
    'app.isAccountOverviewModalVisible',
    'app.isRecentActivityModalVisible',
  ]);

  const middleware = ([...defaultMiddleware, persistMiddleware] as unknown) as [
    Middleware<unknown, NoTaggedState>,
  ];

  // If you are going to load preloaded state from serialized data somewhere
  // here, make sure to convert all needed values from strings to BN
  const store = configureStore<State>({
    reducer: (reducer as Reducer<unknown>) as Reducer<NoTaggedState>,
    preloadedState: (preloadedState as unknown) as DeepPartial<NoTaggedState>,
    middleware,
  });

  return store;
}

export const initializeStore = (
  preloadedState: State,
): ReturnType<typeof initStore> => {
  let store = cachedStore ?? initStore(preloadedState);

  // After navigating to a page with an initial Redux state, merge that state
  // with the current state in the store, and create a new store
  if (preloadedState && cachedStore) {
    store = initStore({
      ...cachedStore.getState(),
      ...preloadedState,
    });
    // Reset the current store
    cachedStore = undefined;
  }

  // For SSG and SSR always create a new store
  if (typeof window === 'undefined') return store;

  // Create the store once in the client
  if (!cachedStore) cachedStore = store;

  return store;
};

export function useStore(state: State): ReturnType<typeof initializeStore> {
  return useMemo(() => initializeStore(state), [state]);
}
