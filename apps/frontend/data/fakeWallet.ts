import { WalletInfo } from '@/state/initialState';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

export const fakeWallet: { [key: string]: WalletInfo } = {
  jEUR: {
    amount: new FPN(233.24),
  },
  jGBP: {
    amount: new FPN(4.61),
  },
};
