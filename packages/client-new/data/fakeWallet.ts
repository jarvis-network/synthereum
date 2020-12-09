import { WalletInfo } from '@/state/initialState';
import { wei } from '@jarvis-network/web3-utils/base/big-number';

export const fakeWallet: { [key: string]: WalletInfo } = {
  jEUR: {
    amount: wei(23324),
  },
  jGBP: {
    amount: wei(461),
  },
};
