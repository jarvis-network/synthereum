import { combineReducers } from '@reduxjs/toolkit'

import theme from "state/slices/theme";

const reducer = combineReducers({
  theme
})

export type RootState = ReturnType<typeof reducer>

export default reducer
