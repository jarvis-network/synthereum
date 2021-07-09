import {
  ExchangeSynthereumToken,
  PoolVersion,
  SupportedNetworkName,
  SynthereumCollateralSymbol,
  SupportedSynthereumSymbol,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { valuesOf } from '@jarvis-network/core-utils/dist/base/meta';

import { PoolsForVersion } from './types/pools';

export function isSupportedSynth<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  token: ExchangeSynthereumToken,
): token is SupportedSynthereumSymbol {
  return token in activePools;
}

export function isSupportedCollateral<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  token: ExchangeSynthereumToken,
): token is SynthereumCollateralSymbol {
  // TODO: optimize by caching a table of all known collateral symbols
  return valuesOf(activePools).some(
    pool => pool?.collateralToken.symbol === token,
  );
}

type TxType = 'mint' | 'exchange' | 'redeem' | 'unsupported';

export function determineSide<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  input: ExchangeSynthereumToken,
  output: ExchangeSynthereumToken,
): TxType {
  const synthInput = isSupportedSynth(activePools, input);
  const synthOutput = isSupportedSynth(activePools, output);
  const collateralInput = isSupportedCollateral(activePools, output);
  const collateralOutput = isSupportedCollateral(activePools, output);
  if (collateralInput && synthOutput) return 'mint';
  if (synthInput && collateralOutput) return 'redeem';
  if (synthInput && synthOutput) return 'exchange';
  return 'unsupported';
}
