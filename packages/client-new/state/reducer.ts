import { combineReducers } from '@reduxjs/toolkit';

import { reducer as theme } from '@/state/slices/theme';
import { reducer as app } from '@/state/slices/app';
import { reducer as auth } from '@/state/slices/auth';
import { reducer as assets } from '@/state/slices/assets';
import { reducer as exchange } from '@/state/slices/exchange';
import { reducer as wallet } from '@/state/slices/wallet';

export const reducer = combineReducers({
  theme,
  app,
  auth,
  assets,
  exchange,
  wallet,
});

export type RootState = ReturnType<typeof reducer>;
