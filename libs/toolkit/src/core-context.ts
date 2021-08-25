import { BehaviorSubject } from 'rxjs';

import { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';
import { createContext } from '@jarvis-network/synthereum-ts/dist/epics/core';
import { Context } from '@jarvis-network/synthereum-ts/dist/epics/types';
import { SupportedNetworkId } from '@jarvis-network/synthereum-config';

export const dependencies = {
  context$: new BehaviorSubject<Context>({
    networkId: null,
    selfMintingRealmAgent: null,
    web3: null,
  }),
};

export const newWeb3Context = async (web3: Web3On<SupportedNetworkId>) => {
  dependencies.context$.next(await createContext(web3));
};

export function emptyWeb3Context() {
  dependencies.context$.next({
    networkId: null,
    selfMintingRealmAgent: null,
    web3: null,
  });
}
