// Contains actions that multiple slices will be subscribing to

import { createAction } from '@reduxjs/toolkit';

export const logoutAction = createAction('logout');

export const addressSwitch = createAction<{ address: string }>('addressSwitch');
export const networkSwitch = createAction<{ networkId: number }>(
  'networkSwitch',
);
