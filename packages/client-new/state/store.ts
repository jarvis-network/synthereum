import { useMemo } from 'react';
import { configureStore, Store } from '@reduxjs/toolkit';

import { reducer } from '@/state/reducer';
import { initialState, State } from '@/state/initialState';

let cachedStore: Store | undefined;

function initStore(preloadedState: State = initialState) {
  // If you are going to load preloaded state from serialized data somewhere
  // here, make sure to convert all needed values from strings to BN
  return configureStore({ reducer, preloadedState });
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
