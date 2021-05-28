import { createAction } from '@reduxjs/toolkit';

// Contains actions that multiple slices will be subscribing to

export const logoutAction = createAction('logout');

export const resetSwapAction = createAction('resetSwap');

export const addressSwitch = createAction<{ address: string }>('addressSwitch');
export const networkSwitch = createAction<{ networkId: number }>(
  'networkSwitch',
);
