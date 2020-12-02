import type { NetworkId } from '@jarvis-network/web3-utils/eth/networks';
import type { Address } from '@jarvis-network/web3-utils/eth/address';
import type { Amount } from '@jarvis-network/web3-utils/base/big-number';
import type { SyntheticSymbol } from './data/all-synthetic-asset-symbols';
export type { SyntheticSymbol };

export interface FixedPointNumber {
  rawValue: string;
}

export type PerNetwork<Config> = {
  [network in NetworkId]?: Config;
};

export interface ContractDependencies {
  expiringMultiPartyCreator: Address;
  tokenFactoryAddress: Address;
  identifierWhitelist: Address;
  finderAddress: Address;
  storeAddress: Address;
  collateralAddress: Address;
  ticFactory: Address;
}

export interface Fees {
  feePercentage: number; // Example: 0.001,
  feeRecipients: Address[]; // Example: ["0xCc3528125499d168ADFB5Ef99895c98a7C430ed4"]
  feeProportions: number[]; // Example: [50, 50]
}

export interface FundAssets {
  syntheticSymbol: SyntheticSymbol; // Example: 'jEUR'
  amount: Amount; // Example: "100000000"
}

export interface SyntheticTokenConfig {
  syntheticName: string; /// Example: "Jarvis Synthetic Euro",
  syntheticSymbol: string; /// Example: "jEUR",
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

