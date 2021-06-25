import { useMemo } from 'react';
import { configureStore, Store, getDefaultMiddleware } from '@reduxjs/toolkit';
import { createEpicMiddleware, EpicMiddleware } from 'redux-observable';

import { getPriceFeedEndpoint } from '@/utils/environment';
import { PriceFeed } from '@/utils/priceFeed';
import { Dependencies } from '@/utils/epics';
import { State, initialAppState } from '@/state/initialState';
import { reducer } from '@/state/reducer';
import { epic } from '@/state/epic';
import { createPersistMiddleware } from '@/state/persist';

let cachedStore: Store | undefined;

function initStore(preloadedState: State = initialAppState) {
  // Create redux-observable middleware
  const epicMiddleware: EpicMiddleware<
    any,
    any,
    never,
    Dependencies
  > = createEpicMiddleware({
    dependencies: {
      priceFeed: new PriceFeed(getPriceFeedEndpoint()),
    },
  });

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
    epicMiddleware,
  ];

  // If you are going to load preloaded state from serialized data somewhere
  // here, make sure to convert all needed values from strings to BN
  const store = configureStore({ reducer, preloadedState, middleware });

  // Initialize react-observable
  epicMiddleware.run(epic);

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
