import { combineReducers } from '@reduxjs/toolkit';

import { reducer as app } from '@/state/slices/app';
import { reducer as auth } from '@/state/slices/auth';
import { reducer as theme } from '@/state/slices/theme';
import { reducer as markets } from '@/state/slices/markets';
import { reducer as wallet } from '@/state/slices/wallet';
import { reducer as prices } from '@/state/slices/prices';

export const reducer = combineReducers({
  app,
  auth,
  theme,
  wallet,
  prices,
  markets,
});

export type RootState = ReturnType<typeof reducer>;
