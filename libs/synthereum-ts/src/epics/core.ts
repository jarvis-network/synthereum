import {
  SupportedNetworkId,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-config';
import { AddressOn } from 'libs/core-utils/dist/eth/address';
import { Web3On } from 'libs/core-utils/dist/eth/web3-instance';
import { map } from 'rxjs';

import { SelfMintingRealmAgent } from '../core/realms/self-minting/agent';
import { loadRealm } from '../core/realms/self-minting/load';
import { ChainLinkPriceFeed } from '../price-feed/chainlink';

import { PriceFeedSymbols } from './price-feed';

import { Context, Epic, ReduxAction } from './types';

export const createContext = async (
  web3: Web3On<SupportedNetworkId>,
): Promise<Context> => {
  const netId = (await web3.eth.net.getId()) as SupportedNetworkId;

  const agentAddress = (
    await web3.eth.getAccounts()
  )[0] as AddressOn<SupportedNetworkName>;

  const realm = await loadRealm(web3, netId);
  const syntheticSymbols = Object.keys(
    realm.selfMintingDerivatives.v1!,
  ) as PriceFeedSymbols[];
  const realmAgent = new SelfMintingRealmAgent(realm, agentAddress, 'v1');

  const chainLinkPriceFeed = new ChainLinkPriceFeed({
    netId,
    web3,
    symbols: [...syntheticSymbols, 'UMA', 'USDC'] as PriceFeedSymbols[],
  });
  await chainLinkPriceFeed.init();

  return {
    web3,
    selfMintingRealmAgent: realmAgent,
    networkId: netId,
    chainLinkPriceFeed,
  };
};

export const realmEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  context$!.pipe(
    map((context: Context) => ({
      type: 'app/contextUpdate',
      payload: context.networkId,
    })),
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
