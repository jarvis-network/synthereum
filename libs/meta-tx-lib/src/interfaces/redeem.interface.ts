import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';

export interface IRedeemRequest {
  sender: AddressOn<SupportedNetworkName>;
  derivativeAddr: AddressOn<SupportedNetworkName>;
  collateralAmount: FPN;
  numTokens: FPN;
  feePercentage: FPN;
  nonce: FPN;
  expiry: string;
}
