import {
  SupportedNetworkName,
  SupportedSelfMintingPairExact,
} from '@jarvis-network/synthereum-config';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';
import { TxOptions } from '@jarvis-network/core-utils/dist/eth/contracts/send-tx';

export interface ContractParams<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  collateral: StringAmount;
  txOptions?: TxOptions;
  pair: SupportedSelfMintingPairExact<Net>;
  numTokens: StringAmount;
  feePercentage: StringAmount;
  slow?: boolean;
  validateOnly?: boolean;
}
