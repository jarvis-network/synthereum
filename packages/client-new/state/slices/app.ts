import { createSlice } from '@reduxjs/toolkit';

import { initialState } from '@/state/initialState';

interface SetModalVisibilityAction {
  payload: boolean;
}

const appSlice = createSlice({
  name: 'app',
  initialState: initialState.app,
  reducers: {
    setAccountOverviewModalVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isAccountOverviewModalVisible: action.payload,
      };
    },
    setRecentActivityModalVisible(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isRecentActivityModalVisible: action.payload,
      };
    },
    setAccountDropdownExpanded(state, action: SetModalVisibilityAction) {
      return {
        ...state,
        isAccountDropdownExpanded: action.payload,
      };
    },
  },
});

export const {
  setAccountOverviewModalVisible,
  setRecentActivityModalVisible,
  setAccountDropdownExpanded,
} = appSlice.actions;
export const { reducer } = appSlice;
