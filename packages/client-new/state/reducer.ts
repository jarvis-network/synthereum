import { combineReducers } from '@reduxjs/toolkit';

import theme from '@/state/slices/theme';
import auth from '@/state/slices/auth';
import assets from '@/state/slices/assets';
import exchange from '@/state/slices/exchange';

const reducer = combineReducers({
  theme,
  auth,
  assets,
  exchange,
});

export type RootState = ReturnType<typeof reducer>;

export default reducer;
