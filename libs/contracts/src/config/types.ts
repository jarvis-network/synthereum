import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';
import { PerTupleElement } from '@jarvis-network/core-utils/dist/base/meta';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import { ToNetworkName } from '@jarvis-network/core-utils/dist/eth/networks';

import {
  SupportedNetworkId,
  SupportedNetworkIds,
  SupportedNetworkName,
} from './supported-networks';

export const poolVersions = ['v4'] as const;
export type PoolVersions = typeof poolVersions;
export type PoolVersion = PoolVersions[number];

export const allSyntheticSymbols = [
  'jEUR',
  'jGBP',
  'jCHF',
  'jXAU',
  'jSPX',
  'jXTI',
  'jXAG',
  'jPHP',
  'jSGD',
] as const;

const collateralSymbols = ['USDC'] as const;
export const collateralSymbol = collateralSymbols[0];
export type CollateralSymbol = typeof collateralSymbols[number];

export type SyntheticSymbol = typeof allSyntheticSymbols[number];

export type ExchangeToken = SyntheticSymbol | CollateralSymbol;

export type PerNetwork<Config> = PerTupleElement<SupportedNetworkIds, Config>;

export type PerAsset<Config> = PerTupleElement<
  typeof allSyntheticSymbols,
  Config
>;

export type PriceFeed = PerAsset<string>;

export type SynthereumConfig = {
  [Net in SupportedNetworkId]: {
    fees: Fees<ToNetworkName<Net>>;
    roles: Roles<ToNetworkName<Net>>;
    contractsDependencies: {
      synthereum: SynthereumContractDependencies<ToNetworkName<Net>>;
      uma: UmaContractDependencies<ToNetworkName<Net>>;
    };
    umaDerivativeConfig: UmaDerivativeConfig<ToNetworkName<Net>>;
    perVersionConfig: {
      [version in PoolVersion]: {
        version: number;
        syntheticTokens: SyntheticTokens;
      };
    };
  };
};

export interface UmaContractDependencies<Net extends SupportedNetworkName> {
  identifierWhitelist: AddressOn<Net>;
  finder: AddressOn<Net>;
}

export interface SynthereumContractDependencies<
  Net extends SupportedNetworkName
> {
  poolRegistry: AddressOn<Net>;
  selfMintingRegistry: AddressOn<Net>;
  primaryCollateralToken: {
    address: AddressOn<Net>;
    symbol: string;
  };
}

export interface Fees<Net extends SupportedNetworkName> {
  feePercentage: StringAmount; // Example: weiString(0.002),
  feeRecipients: AddressOn<Net>[]; // Example: ["0xCc3528125499d168ADFB5Ef99895c98a7C430ed4"]
  feeProportions: number[]; // Example: [50, 50]
}

export interface Roles<Net extends SupportedNetworkName> {
  admin: AddressOn<Net>;
  maintainer: AddressOn<Net>;
  liquidityProvider: AddressOn<Net>;
  validator: AddressOn<Net>;
}

export interface UmaDerivativeConfig<Net extends SupportedNetworkName> {
  disputeBondPct: FixedPointNumber; /// Example: { "rawValue": "50000000000000000" }
  sponsorDisputeRewardPct: FixedPointNumber; /// Example: { "rawValue": "500000000000000000" }
  disputerDisputeRewardPct: FixedPointNumber; /// Example: { "rawValue": "200000000000000000" }
  withdrawalLiveness: number; /// Example: 7200
  liquidationLiveness: number; /// Example: 7200
  excessTokenBeneficiary: AddressOn<Net>;
}

export type SyntheticTokens = {
  [SynthSymbol in SyntheticSymbol]?: SyntheticTokenConfig<SynthSymbol>;
};

export interface SyntheticTokenConfig<
  SynthSymbol extends SyntheticSymbol = SyntheticSymbol
> {
  syntheticName: string; /// Example: "Jarvis Synthetic Euro",
  syntheticSymbol: SynthSymbol; /// Example: "jEUR",
  umaPriceFeedIdentifier: string; /// Example: "EURUSD",
  jarvisPriceFeedIdentifier: string; /// Example: "EURUSD",
  chainlinkPriceFeedIdentifier: string; /// Example: "EURUSD",
  startingCollateralization: string; /// Example: "1527000",
  collateralRequirement: string; /// Example: { "rawValue": "1100000000000000000" },
  minSponsorTokens: string; /// Example: { "rawValue": "1000000000000000000" }
  isContractAllowed: boolean;
}

export interface FixedPointNumber {
  rawValue: StringAmount;
}
