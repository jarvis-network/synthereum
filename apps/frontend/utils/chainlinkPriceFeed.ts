import { BehaviorSubject } from 'rxjs';
import Web3 from 'web3';
import { Subscription } from 'web3-core-subscriptions';
import { Log } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import { chainlinkAddresses } from '@/data/chainlinkAddresses';
import { networkIdToName } from '@jarvis-network/core-utils/dist/eth/networks';
import { useEffect, useState } from 'react';
import { setAssetsPrice } from '@/state/slices/assets';
import {
  reversedPriceFeedPairs,
  SupportedNetworkId,
  SupportedNetworkName,
  isSupportedNetwork,
  synthereumConfig,
  PoolVersion,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { PricesMap, PriceUpdate, SubscriptionPair } from '@/utils/priceFeed';
import { Dispatch } from 'redux';
import {
  chainlinkProxyAggregatorV3InterfaceABI,
  chainlinkProxyAggregatorV3InterfaceABIMumbai,
} from '@/data/chainlinkProxyAggregatorV3InterfaceABI';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { useWeb3 } from '@jarvis-network/app-toolkit';

type Token = keyof typeof synthereumConfig[SupportedNetworkId]['perVersionConfig']['v4']['syntheticTokens'];

type $ = {
  price: number;
  timestamp: number;
} | null;

export class ChainlinkPriceFeed {
  tokens$: {
    [key in Token]: BehaviorSubject<$>;
  } = Object.freeze({
    jEUR: new BehaviorSubject<$>(null),
    jCHF: new BehaviorSubject<$>(null),
    jGBP: new BehaviorSubject<$>(null),
    jXAU: new BehaviorSubject<$>(null),
  });

  private lastRequestAfterBlockNumberForPair: {
    [key in Token]: number;
  } = {
    jEUR: 0,
    jCHF: 0,
    jGBP: 0,
    jXAU: 0,
  };

  private decimals: {
    [key in Token]?: Promise<number>;
  } = {};

  private subscriptions: Subscription<Log>[] = [];

  private getLatestRoundData(token: Token, contract: Contract) {
    Promise.all([
      contract.methods.latestRoundData().call(),
      this.decimals[token] ||
        Promise.reject(
          new Error(`Missing decimals promise for symbol ${token}`),
        ),
    ])
      .then(
        ([{ answer, updatedAt }, decimals]: [
          { answer: string; updatedAt: string },
          number,
        ]) => {
          this.tokens$[token].next({
            price: Number(answer) / 10 ** decimals,
            timestamp: Number(updatedAt),
          });
        },
      )
      .catch(console.error);
  }

  constructor(
    web3: Web3,
    networkId: SupportedNetworkId,
    reset: () => void,
    public readonly poolVersion: Omit<PoolVersion, 'v1' | 'v2'> = 'v4',
  ) {
    const subscriptions: ChainlinkPriceFeed['subscriptions'] = [];
    this.subscriptions = subscriptions;

    const network = networkIdToName[networkId as SupportedNetworkId];
    const enabledTokens = Object.keys(
      synthereumConfig[networkId as SupportedNetworkId].perVersionConfig[
        poolVersion as 'v4'
      ].syntheticTokens,
    ) as Token[];

    // #region contracts object
    const contracts = {} as {
      [key in Token]?: Contract;
    };
    for (const token of enabledTokens) {
      const contract = getContractForSymbol(
        this.poolVersion,
        web3,
        network,
        token,
      );
      contracts[token] = contract;
      const decimalsPromise = contract.methods.decimals().call();
      this.decimals[token] = decimalsPromise;
      decimalsPromise.catch(console.error);
    }
    // #endregion

    // Get current price
    web3.eth
      .getBlockNumber()
      .then(block => {
        for (const token of enabledTokens) {
          this.lastRequestAfterBlockNumberForPair[token] = block;
          this.getLatestRoundData(token, contracts[token]!);
        }
      })
      .catch(console.error);

    for (const token of enabledTokens) {
      // Subscribe for new transactions
      if (!contracts[token]!.methods.aggregator) continue; // mumbai
      contracts[token]!.methods.aggregator()
        .call()
        .then((address: string) => {
          if (subscriptions !== this.subscriptions) return;

          const subscription = web3.eth.subscribe('logs', { address });

          subscription.on('data', data => {
            if (
              data.blockNumber > this.lastRequestAfterBlockNumberForPair[token]
            ) {
              this.lastRequestAfterBlockNumberForPair[token] = data.blockNumber;
              this.getLatestRoundData(token, contracts[token]!);
            }
          });

          // #region Subscribe to aggregator changes
          const aggregatorChangeSubscription = web3.eth.subscribe('logs', {
            address:
              chainlinkAddresses[network][
                getPairForToken(this.poolVersion, token)
              ],
          });

          subscriptions.push(aggregatorChangeSubscription);

          aggregatorChangeSubscription.on('data', () => {
            contracts[token]!.methods.aggregator()
              .call()
              .then((newAddress: string) => {
                if (newAddress !== address) {
                  reset();
                }
              });
          });
          // #endregion
        })
        .catch(console.error);

      // #region Subscribe to aggregator changes
      const subscription = web3.eth.subscribe('logs', {
        address:
          chainlinkAddresses[network][getPairForToken(this.poolVersion, token)],
        // topics: [confirmAggregatorSignature],
      });

      subscriptions.push(subscription);

      subscription.on('data', () => {
        reset();
      });
    }
    // #endregion
  }

  destroy() {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }
}

const reversedReversedPriceFeedPairs = reversedPriceFeedPairs.map(
  pair => `${pair.substr(3)}USD`,
);

const isPairReversed = (pair: SubscriptionPair) =>
  reversedReversedPriceFeedPairs.includes(pair);

function getPricesMapFromPriceUpdate({
  t: _,
  ...data
}: PriceUpdate): PricesMap {
  const keys = Object.keys(data) as SubscriptionPair[];

  return keys.reduce((result, key) => {
    const isReversed = isPairReversed(key);
    const value = data[key];

    return {
      ...result,
      [isReversed ? `USD${key.substr(0, 3)}` : key]: value,
    };
  }, {} as PricesMap);
}

function useChainlinkPriceFeedHook(dispatch: Dispatch) {
  const { library: web3, chainId: networkId } = useWeb3();

  const [resetter, setResetter] = useState(false);

  useEffect(() => {
    if (!web3 || !isSupportedNetwork(networkId)) return;

    const reset = () => setResetter(state => !state);

    const chainlinkPriceFeed = new ChainlinkPriceFeed(web3, networkId, reset);

    const { tokens$: tokens } = chainlinkPriceFeed;
    for (const i in tokens) {
      if (!Object.prototype.hasOwnProperty.call(tokens, i)) continue;
      const token = i as keyof typeof tokens;
      const $ = tokens[token];
      const pair = getPairForToken(chainlinkPriceFeed.poolVersion, token);
      $.subscribe(value => {
        if (!value) return;

        dispatch(
          setAssetsPrice(
            getPricesMapFromPriceUpdate({
              t: value.timestamp * 1000,
              [pair]: value.price,
            } as PriceUpdate),
          ),
        );
      });
    }

    return () => {
      chainlinkPriceFeed.destroy();
    };
  }, [web3, networkId, resetter]);
}

export const useChainlinkPriceFeed =
  process.env.NEXT_PUBLIC_POOL_VERSION !== 'v1' &&
  process.env.NEXT_PUBLIC_POOL_VERSION !== 'v2'
    ? useChainlinkPriceFeedHook
    : () => undefined;

function getPairForToken(
  poolVersion: Omit<PoolVersion, 'v1' | 'v2'>,
  token: Token,
) {
  const { syntheticTokens } = synthereumConfig[1].perVersionConfig[
    poolVersion as 'v4'
  ];
  if (process.env.NODE_ENV === 'development') {
    const x = (1 as unknown) as typeof syntheticTokens[keyof typeof syntheticTokens]['chainlinkPriceFeedIdentifier'];

    type ValueOf<T> = T[keyof T];

    // type N1V1 = typeof synthereumConfig[1]['perVersionConfig']['v1']['syntheticTokens'];
    // typeCheck<ValueOf<N1V1>['chainlinkPriceFeedIdentifier']>()(x);
    // type N1V2 = typeof synthereumConfig[1]['perVersionConfig']['v2']['syntheticTokens'];
    // typeCheck<ValueOf<N1V2>['chainlinkPriceFeedIdentifier']>()(x);
    // type N1V3 = typeof synthereumConfig[1]['perVersionConfig']['v3']['syntheticTokens'];
    // typeCheck<ValueOf<N1V3>['chainlinkPriceFeedIdentifier']>()(x);
    type N1V4 = typeof synthereumConfig[1]['perVersionConfig']['v4']['syntheticTokens'];
    typeCheck<ValueOf<N1V4>['chainlinkPriceFeedIdentifier']>()(x);

    // type N42V1 = typeof synthereumConfig[42]['perVersionConfig']['v1']['syntheticTokens'];
    // typeCheck<ValueOf<N42V1>['chainlinkPriceFeedIdentifier']>()(x);
    // type N42V2 = typeof synthereumConfig[42]['perVersionConfig']['v2']['syntheticTokens'];
    // typeCheck<ValueOf<N42V2>['chainlinkPriceFeedIdentifier']>()(x);
    // type N42V3 = typeof synthereumConfig[42]['perVersionConfig']['v3']['syntheticTokens'];
    // typeCheck<ValueOf<N42V3>['chainlinkPriceFeedIdentifier']>()(x);
    type N42V4 = typeof synthereumConfig[42]['perVersionConfig']['v4']['syntheticTokens'];
    typeCheck<ValueOf<N42V4>['chainlinkPriceFeedIdentifier']>()(x);
  }

  if (token in syntheticTokens) {
    return syntheticTokens[token as keyof typeof syntheticTokens]
      .chainlinkPriceFeedIdentifier;
  }

  throw new Error(`Token ${token} not supported`);
}

function getContractForSymbol(
  poolVersion: Omit<PoolVersion, 'v1' | 'v2'>,
  web3: Web3,
  network: SupportedNetworkName,
  token: Token,
) {
  return new web3.eth.Contract(
    network === 'mumbai'
      ? chainlinkProxyAggregatorV3InterfaceABIMumbai
      : chainlinkProxyAggregatorV3InterfaceABI,
    chainlinkAddresses[network][getPairForToken(poolVersion, token)],
  );
}
