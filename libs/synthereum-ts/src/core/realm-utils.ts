import {
  CollateralSymbol,
  ExchangeToken,
  PoolVersion,
  SupportedNetworkName,
  SyntheticSymbol,
} from '@jarvis-network/synthereum-contracts/dist/config';

import { PoolsForVersion } from './types/pools';

export function isSupportedSynth<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  token: ExchangeToken,
): token is SyntheticSymbol {
  return token in activePools;
}

export function isSupportedCollateral<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  token: ExchangeToken,
): token is CollateralSymbol {
  // TODO: optimize by caching a table of all known collateral symbols
  return Object.values(activePools).some(
    pool => pool?.collateralToken.symbol === token,
  );
}

type TxType = 'mint' | 'exchange' | 'redeem' | 'unsupported';

export function determineSide<
  Version extends PoolVersion,
  Net extends SupportedNetworkName
>(
  activePools: PoolsForVersion<Version, Net>,
  input: ExchangeToken,
  output: ExchangeToken,
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
