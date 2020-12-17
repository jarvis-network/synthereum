import { Action, Store } from 'redux';
import requestIdleCallback from 'ric-shim';

import { addHistory, addPriceUpdate } from '@/state/slices/prices';
import { cache } from '@/utils/cache';

const ActionsToPersist = {
  [addHistory.type]: ['prices'],
  [addPriceUpdate.type]: ['prices'],
} as const;

export const persistMiddleware = (store: Store) => (next: Function) => (
  action: Action<any>,
) => {
  const result = next(action);
  const reducersToPersist = ActionsToPersist[action.type];

  if (reducersToPersist) {
    const appState = store.getState();

    requestIdleCallback(() => {
      reducersToPersist.forEach(
        reducerName => cache && cache.set(reducerName, appState[reducerName]),
      );
    });
  }

  return result;
};
