import { useMemo } from 'react';
import { configureStore, Store, getDefaultMiddleware } from '@reduxjs/toolkit';

import { State, initialState } from '@/state/initialState';
import { reducer } from '@/state/reducer';
import { createPersistMiddleware } from '@/state/persist';

let cachedStore: Store | undefined;

function initStore(preloadedState: State = initialState) {
  const middleware = [
    ...getDefaultMiddleware(),
    createPersistMiddleware([
      'theme',
      'exchange.payAsset',
      'exchange.receiveAsset',
      'exchange.chartDays',
      'app.isAccountOverviewModalVisible',
      'app.isRecentActivityModalVisible',
    ]),
  ];

  // If you are going to load preloaded state from serialized data somewhere
  // here, make sure to convert all needed values from strings to BN
  return configureStore({ reducer, preloadedState, middleware });
}

export const initializeStore = (preloadedState: State) => {
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

export function useStore(state: State) {
  return useMemo(() => initializeStore(state), [state]);
}
