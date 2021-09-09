import { BehaviorSubject, Subscription as RxSubscription } from 'rxjs';
import { chainlinkAddresses } from '@/data/chainlinkAddresses';
import { networkIdToName } from '@jarvis-network/core-utils/dist/eth/networks';
import { useEffect } from 'react';
import { setAssetsPrice } from '@/state/slices/prices_';
import {
  reversedPriceFeedPairs,
  SupportedNetworkId,
  isSupportedNetwork,
  synthereumConfig,
  PoolVersion,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { PricesMap, PriceUpdate, SubscriptionPair } from '@/utils/priceFeed';
import { Dispatch } from 'redux';
import { chainlinkProxyAggregatorV3InterfaceABI } from '@/data/chainlinkProxyAggregatorV3InterfaceABI';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { useMulticallContext, useWeb3 } from '@jarvis-network/app-toolkit';
import BN from 'bn.js';

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
  });

  private multicallIds: { [key: string]: Token } = {};

  private decimalsMulticallIds: { [key in Token]: string } = {
    jEUR: '',
    jGBP: '',
    jCHF: '',
  };

  private lastResultsSubscription?: RxSubscription;

  constructor(
    networkId: number,
    private multicall: ReturnType<typeof useMulticallContext>,
    public readonly poolVersion: Omit<PoolVersion, 'v1' | 'v2'> = 'v4',
  ) {
    const networkIsSupported = networkId && isSupportedNetwork(networkId);
    if (!networkIsSupported) return;
    const network = networkIdToName[networkId as SupportedNetworkId];
    const enabledTokens = Object.keys(
      synthereumConfig[networkId as SupportedNetworkId].perVersionConfig[
        poolVersion as 'v4'
      ].syntheticTokens,
    ) as Token[];

    for (const token of enabledTokens) {
      const contractAddress =
        chainlinkAddresses[network][getPairForToken(this.poolVersion, token)];

      const id = multicall.add({
        abi: chainlinkProxyAggregatorV3InterfaceABI,
        calls: [
          {
            methodName: 'latestRoundData',
            methodParameters: [],
            reference: '',
          },
        ],
        contractAddress,
      });
      this.multicallIds[id] = token;

      const decimalsId = multicall.add({
        abi: chainlinkProxyAggregatorV3InterfaceABI,
        calls: [
          {
            methodName: 'decimals',
            methodParameters: [],
            reference: '',
          },
        ],
        contractAddress,
      });
      this.decimalsMulticallIds[token] = decimalsId;
    }

    this.lastResultsSubscription = multicall.lastResults$.subscribe(values => {
      const decimalsMap: { [key in Token]: number } = {
        jEUR: -1,
        jGBP: -1,
        jCHF: -1,
      };

      // eslint-disable-next-line guard-for-in
      for (const token in this.decimalsMulticallIds) {
        const id = this.decimalsMulticallIds[token as 'jEUR'];
        if (!id) continue;
        const result = values.results[id];
        if (!result) continue;

        decimalsMap[token as 'jEUR'] = result.callsReturnContext[0]
          .returnValues[0] as number;
      }

      // eslint-disable-next-line guard-for-in
      for (const id in this.multicallIds) {
        const result = values.results[id];
        if (!values.results[id]) continue;
        const token = this.multicallIds[id];
        const decimals = decimalsMap[token];
        if (decimals === -1) continue;

        const answer = new BN(
          result.callsReturnContext[0].returnValues[1].hex.substr(2),
          'hex',
        ).toNumber();
        const updatedAt = new BN(
          result.callsReturnContext[0].returnValues[3].hex.substr(2),
          'hex',
        ).toNumber();

        const token$ = this.tokens$[token];
        const price = Number(answer) / 10 ** decimals;
        if (price !== token$.value?.price) {
          this.tokens$[token].next({
            price,
            timestamp: Number(updatedAt),
          });
        }
      }
    });
  }

  private multicallRemove() {
    // eslint-disable-next-line guard-for-in
    for (const i in this.multicallIds) {
      this.multicall.remove(i);
      delete this.multicallIds[i];
    }

    for (const id of Object.values(this.decimalsMulticallIds)) {
      this.multicall.remove(id);
    }
  }

  destroy(): void {
    this.multicallRemove();

    this.lastResultsSubscription?.unsubscribe();
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
  const multicall = useMulticallContext();
  const { library: web3, chainId: networkId } = useWeb3();

  useEffect(() => {
    if (!networkId) return;

    const chainlinkPriceFeed = new ChainlinkPriceFeed(networkId, multicall);

    const subscriptions: RxSubscription[] = [];

    const { tokens$: tokens } = chainlinkPriceFeed;
    for (const i in tokens) {
      if (!Object.prototype.hasOwnProperty.call(tokens, i)) continue;
      const token = i as keyof typeof tokens;
      const $ = tokens[token];
      const pair = getPairForToken(chainlinkPriceFeed.poolVersion, token);
      subscriptions.push(
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
        }),
      );
    }

    return () => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }

      chainlinkPriceFeed.destroy();
    };
  }, [dispatch, networkId, web3, multicall]);
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
