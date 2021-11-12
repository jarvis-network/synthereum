import { combineReducers } from '@reduxjs/toolkit';

import { reducer as app } from '@/state/slices/app';
import { reducer as theme } from '@/state/slices/theme';
import { reducer as claim } from '@/state/slices/claim';
import { reducer as history } from '@/state/slices/history';

export const reducer = combineReducers({
  app,
  theme,
  claim,
  history,
});

export type RootState = ReturnType<typeof reducer>;
