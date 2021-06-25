import type {
  SupportedNetworkName,
  SyntheticSymbol,
} from '@jarvis-network/synthereum-contracts/dist/config';
import {
  ContractInfo,
  TokenInfo,
} from '@jarvis-network/core-utils/dist/eth/contracts/types';
import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';
import { SelfMintingPerpetualMultiParty } from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';
import { priceFeed } from '@jarvis-network/synthereum-contracts/dist/config';

export const selfMintingVersions = ['v1'] as const;
export type SelfMintingVersions = typeof selfMintingVersions;
export type SelfMintingVersion = SelfMintingVersions[number];

export type SelfMintingDerivativeContract = SelfMintingPerpetualMultiParty;

export interface SelfMintingDerivative<
  Version extends SelfMintingVersion,
  Net extends SupportedNetworkName = SupportedNetworkName,
  SynthSymbol extends SyntheticSymbol = SyntheticSymbol
> extends ContractInfo<Net, SelfMintingDerivativeContract> {
  networkId: ToNetworkId<Net>;
  versionId: Version;
  symbol: SynthSymbol;
  priceFeed: typeof priceFeed[SynthSymbol];
  collateralToken: TokenInfo<Net>;
  syntheticToken: TokenInfo<Net>;
}

export type DerivativesForVersion<
  Version extends SelfMintingVersion,
  Net extends SupportedNetworkName
> = {
  [SynthSymbol in SyntheticSymbol]?: SelfMintingDerivative<
    Version,
    Net,
    SynthSymbol
  >;
};
