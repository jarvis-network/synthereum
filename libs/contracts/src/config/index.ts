export {
  priceFeed,
  allSyntheticSymbols,
  primaryCollateralSymbol,
  reversedPriceFeedPairs,
} from './types/price-feed-symbols';
export type {
  SynthereumCollateralSymbol,
  SyntheticSymbol,
  PerAsset,
} from './types/price-feed-symbols';

export { poolVersions } from './supported/pool-versions';
export type { PoolVersion, PoolVersions } from './supported/pool-versions';

export { supportedSynthereumPairs } from './supported/synthereum-pairs';
export type {
  SupportedSynthereumPair,
  SupportedSynthereumSymbol,
  ExchangeSynthereumToken,
  PerSynthereumPair,
} from './supported/synthereum-pairs';

export type {
  ExchangeSelfMintingToken,
  PerSelfMintingPair,
  SupportedSelfMintingPair,
  SupportedSelfMintingSymbol,
} from './supported/self-minting-pairs';

export type {
  Fees,
  SynthereumConfig,
  SynthereumContractDependencies,
} from './types/config';

export { synthereumConfig } from './data';

export {
  parseSupportedNetworkId,
  isSupportedNetwork,
} from './supported/networks';
export type {
  SupportedNetworkId,
  SupportedNetworkName,
} from './supported/networks';
