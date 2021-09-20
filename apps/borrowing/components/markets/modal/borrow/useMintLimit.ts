import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import { useMemo } from 'react';

import { errors } from './messages';

interface Result {
  isMintLimitReached: boolean;
  mintLimitReachMessage: string | null;
}
const success = (): Result => ({
  isMintLimitReached: false,
  mintLimitReachMessage: null,
});
export const useMintLimit = (
  syntheticValue: string,
  assetDetails: Market | null,
): Result =>
  useMemo(() => {
    if (syntheticValue !== '') {
      const syntheticInput = FPN.toWei(syntheticValue.toString());

      /* ------------------------- Add mint limit reached ------------------------- */
      const capMintAmount = FPN.fromWei(
        assetDetails!.capMintAmount!.toString(),
      );
      const totalTokenOutstanding = FPN.fromWei(
        assetDetails!.totalTokensOutstanding!.toString(),
      );
      if (totalTokenOutstanding.add(syntheticInput).gt(capMintAmount)) {
        return {
          isMintLimitReached: true,
          mintLimitReachMessage: errors.mlr,
        };
      }
    }
    return success();
  }, [syntheticValue]);
