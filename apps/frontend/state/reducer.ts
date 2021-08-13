import { combineReducers } from '@reduxjs/toolkit';

import { reducer as theme } from '@/state/slices/theme';
import { reducer as app } from '@/state/slices/app';
import { reducer as assets } from '@/state/slices/assets';
import { reducer as exchange } from '@/state/slices/exchange';
import { reducer as wallet } from '@/state/slices/wallet';
import { reducer as transactions } from '@/state/slices/transactions';
import { reducer as prices } from '@/state/slices/prices';

export const reducer = combineReducers({
  theme,
  app,
  assets,
  exchange,
  wallet,
  transactions,
  prices,
});

export type RootState = ReturnType<typeof reducer>;
