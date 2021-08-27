import type {
  SupportedNetworkName,
  SupportedSelfMintingPairExact,
} from '@jarvis-network/synthereum-config';
import {
  ContractInfo,
  ContractInstance,
  TokenInfo,
} from '@jarvis-network/core-utils/dist/eth/contracts/types';
import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';
import { SelfMintingPerpetualMultiParty } from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';
import {
  SyntheticSymbolOf,
  CollateralOf,
} from '@jarvis-network/synthereum-config';
import { Amount } from 'libs/core-utils/dist/base/big-number';

export const selfMintingVersions = ['v1'] as const;
export type SelfMintingVersions = typeof selfMintingVersions;
export type SelfMintingVersion = SelfMintingVersions[number];

export type SelfMintingDerivativeContract = SelfMintingPerpetualMultiParty;
export interface SelfMintingDerivativeInfo<
  Version extends SelfMintingVersion,
  Net extends SupportedNetworkName = SupportedNetworkName,
  Pair extends SupportedSelfMintingPairExact<Net> = SupportedSelfMintingPairExact<Net>
> extends ContractInfo<Net, SelfMintingDerivativeContract> {
  networkId: ToNetworkId<Net>;
  versionId: Version;
  pair: Pair;
  collateralToken: TokenInfo<Net, CollateralOf<Pair>>;
  syntheticToken: TokenInfo<Net, SyntheticSymbolOf<Pair>>;
}
export interface SelfMintingDerivativeData {
  feePercentage: Amount;
  capDepositRatio: Amount;
  collateralRequirement: Amount;
  capMintAmount: Amount;
  totalPositionCollateral: Amount;
  totalTokensOutstanding: Amount;
}
export interface SelfMintingDerivative<
  Version extends SelfMintingVersion,
  Net extends SupportedNetworkName = SupportedNetworkName,
  Pair extends SupportedSelfMintingPairExact<Net> = SupportedSelfMintingPairExact<Net>
> extends ContractInstance<Net, SelfMintingDerivativeContract> {
  static: SelfMintingDerivativeInfo<Version, Net, Pair>;
  dynamic: SelfMintingDerivativeData;
}

export type DerivativesForVersion<
  Version extends SelfMintingVersion,
  Net extends SupportedNetworkName
> = {
  [Pair in SupportedSelfMintingPairExact<Net>]?: SelfMintingDerivative<
    Version,
    Net,
    Pair
  >;
};
