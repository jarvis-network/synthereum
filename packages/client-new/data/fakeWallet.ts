import { WalletInfo } from '@/state/initialState';
import BN from 'bn.js';

export const fakeWallet: { [key: string]: WalletInfo } = {
  jEUR: {
    amount: new BN('23324'),
  },
  jGBP: {
    amount: new BN('461'),
  },
};
