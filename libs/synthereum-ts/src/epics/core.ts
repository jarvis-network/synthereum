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

  let chainLinkPriceFeed!: ChainLinkPriceFeed;
  let realmAgent!: SelfMintingRealmAgent;
  let syntheticSymbols!: PriceFeedSymbols[];
  try {
    const realm = await loadRealm(web3, netId);
    syntheticSymbols = Object.keys(
      realm.selfMintingDerivatives.v1!,
    ) as PriceFeedSymbols[];
    realmAgent = new SelfMintingRealmAgent(
      realm,
      (await web3.eth.getAccounts())[0] as AddressOn<SupportedNetworkName>,
      'v1',
    );
  } catch (error) {
    console.log('Unable to load realmAgent', error);
  }
  try {
    chainLinkPriceFeed = new ChainLinkPriceFeed({
      netId,
      web3,
      symbols: [...syntheticSymbols, 'UMA', 'USDC'] as PriceFeedSymbols[],
    });
    await chainLinkPriceFeed.init();
  } catch (error) {
    console.log('Unable to load priceFeed', error);
  }

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
    map((context: Context) => {
      console.log(context.networkId);
      return { type: 'app/contextUpdate', payload: context.networkId };
    }),
  );
