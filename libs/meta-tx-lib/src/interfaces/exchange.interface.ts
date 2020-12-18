import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';

export interface IExchangeRequest {
  sender: AddressOn<SupportedNetworkName>;
  derivativeAddr: AddressOn<SupportedNetworkName>;
  destPoolAddr: AddressOn<SupportedNetworkName>;
  destDerivativeAddr: AddressOn<SupportedNetworkName>;
  numTokens: FPN;
  collateralAmount: FPN;
  destNumTokens: FPN;
  feePercentage: FPN;
  nonce: FPN;
  expiry: string;
}
