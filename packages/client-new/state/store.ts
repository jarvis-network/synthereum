import { useMemo } from 'react';
import { configureStore } from '@reduxjs/toolkit';

import reducer from '@/state/reducer';
import initialState, { State } from '@/state/initialState';

let cachedStore;

function initStore(preloadedState: State = initialState) {
  return configureStore({ reducer, preloadedState });
}

export const initializeStore = preloadedState => {
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

export function useStore(state) {
  return useMemo(() => initializeStore(state), [state]);
}
