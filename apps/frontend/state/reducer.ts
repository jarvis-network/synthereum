import { combineReducers } from '@reduxjs/toolkit';

import { reducer as theme } from '@/state/slices/theme';
import { reducer as app } from '@/state/slices/app';
import { reducer as exchange } from '@/state/slices/exchange';
import { reducer as wallet } from '@/state/slices/wallet';
import { reducer as transactions } from '@/state/slices/transactions';
import { reducer as prices } from '@/state/slices/prices_';
import { reducer as cache } from '@/state/slices/cache';

export const reducer = combineReducers({
  theme,
  app,
  exchange,
  wallet,
  transactions,
  prices,
  cache,
});

export type RootState = ReturnType<typeof reducer>;
