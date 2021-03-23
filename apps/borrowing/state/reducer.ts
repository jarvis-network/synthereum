import { combineReducers } from '@reduxjs/toolkit';

import { reducer as theme } from '@/state/slices/theme';

export const reducer = combineReducers({
  theme,
});

export type RootState = ReturnType<typeof reducer>;
