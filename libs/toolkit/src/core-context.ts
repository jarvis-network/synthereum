import { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';
import {
  createContext,
  updateAddress,
} from '@jarvis-network/synthereum-ts/dist/epics/core';
import { context$ } from '@jarvis-network/synthereum-ts/dist/epics/types';
import {
  SupportedNetworkId,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-config/dist';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';

export const dependencies = {
  context$,
};

export const newWeb3Context = async (web3: Web3On<SupportedNetworkId>) => {
  context$.next(await createContext(web3));
};

export const onAddressUpdate = async (
  address: AddressOn<SupportedNetworkName> | undefined,
) => {
  if (address) {
    context$.next(await updateAddress(address));
  } else {
    context$.next(null);
  }
};

export function emptyWeb3Context() {
  context$.next({
    chainLinkPriceFeed: null,
    networkId: null,
    selfMintingRealmAgent: null,
    web3: null,
    realm: null,
  });
}
