import type {
  Address,
  AddressOn,
} from '@jarvis-network/web3-utils/eth/address';
import type { Amount } from '@jarvis-network/web3-utils/base/big-number';
import type {
  SupportedNetworkIds,
  SupportedNetworkId,
  SupportedNetworkName,
} from './supported-networks';
export type { SupportedNetworkId, SupportedNetworkName };
import {
  allSupportedSymbols,
  SyntheticSymbols,
  SyntheticSymbol,
  AnySyntheticSymbol,
} from './data/all-synthetic-asset-symbols';
export type { SyntheticSymbol };
import {
  mapTupleToObject,
  PerTupleElement,
} from '@jarvis-network/web3-utils/base/meta';

export interface FixedPointNumber {
  rawValue: string;
}

export type PerNetwork<Config> = PerTupleElement<SupportedNetworkIds, Config>;

export type PerAsset<Config> = PerTupleElement<SyntheticSymbols, Config>;

export function mapAsset<F extends (sym: SyntheticSymbol) => T, T>(
  mapFun: F,
): PerAsset<T> {
  return mapTupleToObject(allSupportedSymbols, mapFun);
}

export interface ContractDependencies<Net extends SupportedNetworkName> {
  identifierWhitelist: AddressOn<Net>;
  finderAddress: AddressOn<Net>;
  collateralAddress: AddressOn<Net>;
  poolRegistry: AddressOn<Net>;
}

export interface Fees {
  feePercentage: number; // Example: 0.001,
  readonly feeRecipients: Readonly<Address[]>; // Example: ["0xCc3528125499d168ADFB5Ef99895c98a7C430ed4"]
  readonly feeProportions: Readonly<number[]>; // Example: [50, 50]
}

export type AssetFundingConfig = PerAsset<Amount>;

export interface SyntheticTokenConfig<
  Symbol extends AnySyntheticSymbol = SyntheticSymbol
> {
  syntheticName: string; /// Example: "Jarvis Synthetic Euro",
  syntheticSymbol: Symbol; /// Example: "jEUR",
  priceFeedIdentifier: string; /// Example: "EUR/USD",
  collateralRequirement: FixedPointNumber; /// Example: { "rawValue": "1100000000000000000" },
  startingCollateralization: string; /// Example: "1527000",
  minSponsorTokens: FixedPointNumber; /// Example: { "rawValue": "1000000000000000000" }
}

export interface Roles {
  admin: Address;
  maintainer: Address;
  liquidityProvider: Address;
  validator: Address;
}

export interface TicConfig {
  expirationTimestamp: number; /// Example: 1625097600,
  disputeBondPct: FixedPointNumber; /// Example: { "rawValue": "1500000000000000000" },
  sponsorDisputeRewardPct: FixedPointNumber; /// Example: { "rawValue": "500000000000000000" },
  disputerDisputeRewardPct: FixedPointNumber; /// Example: { "rawValue": "400000000000000000" },
  withdrawalLiveness: number; /// Example: 3600,
  liquidationLiveness: number; /// Example: 3600
}

export interface AssetFunding {
  syntheticSymbol: SyntheticSymbol;
  amount: Amount;
}
