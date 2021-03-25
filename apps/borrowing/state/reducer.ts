import { combineReducers } from '@reduxjs/toolkit';

import { reducer as app } from '@/state/slices/app';
import { reducer as auth } from '@/state/slices/auth';
import { reducer as theme } from '@/state/slices/theme';
import { reducer as markets } from '@/state/slices/markets';

export const reducer = combineReducers({
  app,
  auth,
  theme,
  markets,
});

export type RootState = ReturnType<typeof reducer>;
