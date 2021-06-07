import { combineReducers } from '@reduxjs/toolkit';

import { reducer as app } from '@/state/slices/app';
import { reducer as auth } from '@/state/slices/auth';
import { reducer as theme } from '@/state/slices/theme';
import { reducer as claim } from '@/state/slices/claim';

export const reducer = combineReducers({
  app,
  auth,
  theme,
  claim,
});

export type RootState = ReturnType<typeof reducer>;
