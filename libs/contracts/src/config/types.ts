import {
  SupportedNetworkName,
  SupportedNetworkId,
  SupportedNetworkIds,
} from './supported-networks';
import { PoolVersion } from '../core/types/pools';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { PerTupleElement } from '@jarvis-network/web3-utils/base/meta';
import { ToNetworkName } from '@jarvis-network/web3-utils/eth/networks';

export const allSyntheticSymbols = [
  'jEUR',
  'jGBP',
  'jCHF',
  'jXAU',
  'jSPX',
  'jXTI',
  'jXAG',
] as const;

export const primaryCollateralSymbol = 'USDC';

export type SyntheticSymbol = typeof allSyntheticSymbols[number];

export type ExchangeToken = SyntheticSymbol | typeof primaryCollateralSymbol;

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
  primaryCollateralToken: {
    address: AddressOn<Net>;
    symbol: string;
  };
}

export interface Fees<Net extends SupportedNetworkName> {
  feePercentage: number; // Example: 0.002,
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
  [Symbol in SyntheticSymbol]?: SyntheticTokenConfig<Symbol>;
};

export interface SyntheticTokenConfig<
  Symbol extends SyntheticSymbol = SyntheticSymbol
> {
  syntheticName: string; /// Example: "Jarvis Synthetic Euro",
  syntheticSymbol: Symbol; /// Example: "jEUR",
  umaPriceFeedIdentifier: string; /// Example: "EURUSD",
  jarvisPriceFeedIdentifier: string; /// Example: "EURUSD",
  startingCollateralization: string; /// Example: "1527000",
  collateralRequirement: string; /// Example: { "rawValue": "1100000000000000000" },
  minSponsorTokens: string; /// Example: { "rawValue": "1000000000000000000" }
  isContractAllowed: boolean;
}

export interface FixedPointNumber {
  rawValue: string;
}
