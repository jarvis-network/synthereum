import {
  SupportedNetworkId,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-config';
import { AddressOn } from 'libs/core-utils/dist/eth/address';
import { Web3On } from 'libs/core-utils/dist/eth/web3-instance';
import { filter, firstValueFrom, map, takeUntil } from 'rxjs';

import { SelfMintingRealmAgent } from '../core/realms/self-minting/agent';
import { loadRealm } from '../core/realms/self-minting/load';
import { ChainLinkPriceFeed } from '../price-feed/chainlink';

import { PriceFeedSymbols } from './price-feed';

import {
  Context,
  context$ as contextStream$,
  Epic,
  ReduxAction,
} from './types';

export const createContext = async (
  web3: Web3On<SupportedNetworkId>,
): Promise<Context> => {
  const netId = (await web3.eth.net.getId()) as SupportedNetworkId;
  const realm = await loadRealm(web3, netId);
  const syntheticSymbols = Object.keys(
    realm.selfMintingDerivatives.v1!,
  ) as PriceFeedSymbols[];

  const chainLinkPriceFeed = new ChainLinkPriceFeed({
    netId,
    web3,
    symbols: [...syntheticSymbols, 'UMA', 'USDC'] as PriceFeedSymbols[],
  });
  chainLinkPriceFeed.init();

  return {
    web3,
    networkId: netId,
    chainLinkPriceFeed,
    selfMintingRealmAgent: null,
    realm,
  };
};

export const updateAddress = async (
  agentAddress: AddressOn<SupportedNetworkName>,
): Promise<Context> => {
  const { realm, ...context } = await firstValueFrom(
    contextStream$.pipe(filter(a => a.web3 !== null)),
  );
  const realmAgent = new SelfMintingRealmAgent(realm!, agentAddress, 'v1');
  return {
    ...context,
    selfMintingRealmAgent: realmAgent,
    realm,
  };
};

export const realmEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  context$!.pipe(
    map(
      (context: Context) => ({
        type: 'app/contextUpdate',
        payload: {
          networkId: context.networkId,
          agentAddress: context.selfMintingRealmAgent?.agentAddress.toLowerCase(),
        },
      }),
      takeUntil(
        action$.pipe(
          filter(a => a.type === 'networkSwitch' || a.type === 'addressSwitch'),
        ),
      ),
    ),
  );

export const AppEvents = [
  'networkSwitch',
  'addressSwitch',
  'transaction/metaMaskError',
  'transaction/cancel',
  'transaction/reset',
  'transaction/confirmed',
  'transaction/send',
  'transaction/validate',
  'transaction/metaMaskConfirmation',
  'approveTransaction/cancel',
  'approveTransaction/confirmed',
  'approveTransaction/send',
  'approveTransaction/metaMaskConfirmation',
];
