import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config/dist';

import { errors } from './messages';

interface Result {
  insufficientFunds: boolean;
  balanceErrorMessage: string | null;
  balance: FPN;
}

const zero = (): Result => ({
  insufficientFunds: false,
  balanceErrorMessage: null,
  balance: new FPN(0),
});

export const useBalance = (
  collateralValue: string,
  assetKey: SupportedSelfMintingPairExact,
): Result => {
  const tokenBalances = useReduxSelector(state => state.wallet);
  const selectedAsset = selfMintingMarketAssets[assetKey];

  if (tokenBalances[selectedAsset.assetIn.name]) {
    const b = tokenBalances[selectedAsset.assetOut.name]!.amount;
    const balance = b ? FPN.fromWei(b) : new FPN('0');
    const insufficientFunds = balance.lt(
      new FPN(collateralValue === '' ? '0' : collateralValue),
    )!;
    const errorMessage = insufficientFunds ? errors.isf : null;
    return {
      insufficientFunds,
      balanceErrorMessage: errorMessage,
      balance,
    };
  }
  return zero();
};
