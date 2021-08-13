import { createAction } from '@reduxjs/toolkit';

// Contains actions that multiple slices will be subscribing to

export const resetSwapAction = createAction('resetSwap');
