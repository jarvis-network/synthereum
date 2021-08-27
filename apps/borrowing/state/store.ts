import { useMemo } from 'react';
import { configureStore, Store, getDefaultMiddleware } from '@reduxjs/toolkit';

import { State, initialAppState } from '@/state/initialState';
import { reducer } from '@/state/reducer';
import { createPersistMiddleware } from '@/state/persist';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
import { ReduxAction } from '@jarvis-network/synthereum-ts/dist/epics/types';
import { priceFeedEpic } from '@jarvis-network/synthereum-ts/dist/epics/price-feed';
import { dependencies } from '@jarvis-network/app-toolkit/dist/core-context';
import { marketEpic } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import { borrowEpic } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/borrow';
import { depositEpic } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/deposit';
import { redeemEpic } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/redeem';
import { repayEpic } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/repay';
import {
  withdrawEpic,
  withdrawCancelEpic,
  withdrawApproveEpic,
} from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/withdraw';
import { realmEpic } from '@jarvis-network/synthereum-ts/dist/epics/core';
let cachedStore: Store | undefined;

const epicMiddleware = createEpicMiddleware<ReduxAction, ReduxAction, State>({
  dependencies,
});

function initStore(preloadedState: State = initialAppState) {
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

export const initializeStore = (
  preloadedState: State,
): ReturnType<typeof initStore> => {
  let store = cachedStore ?? initStore(preloadedState);
  const rootEpic = combineEpics(
    priceFeedEpic,
    marketEpic,
    borrowEpic,
    depositEpic,
    redeemEpic,
    realmEpic,
    repayEpic,
    withdrawEpic,
    withdrawCancelEpic,
    withdrawApproveEpic,
  );
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
  epicMiddleware.run(rootEpic);

  return store;
};

export function useStore(state: State): ReturnType<typeof initializeStore> {
  return useMemo(() => initializeStore(state), [state]);
}
