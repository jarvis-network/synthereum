import { combineReducers } from '@reduxjs/toolkit';

import theme from '@/state/slices/theme';
import auth from '@/state/slices/auth';

const reducer = combineReducers({
  theme,
  auth,
});

export type RootState = ReturnType<typeof reducer>;

export default reducer;
