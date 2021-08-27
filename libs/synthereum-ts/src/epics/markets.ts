import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';
import {
  AssetSymbol,
  SelfMintingCollateralSymbol,
} from '@jarvis-network/synthereum-config';

import {
  map,
  switchMap,
  switchMapTo,
  filter,
  BehaviorSubject,
  tap,
} from 'rxjs';

import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { Empty } from '@jarvis-network/core-utils/dist/base/optional';

import {
  calculateGCR,
  getLiquidationRatio,
} from '../core/realms/self-minting/utils';

import { SelfMintingRealmAgent } from '../core/realms/self-minting/agent';

import { ChainLinkPriceFeed } from '../price-feed/chainlink';

import { Context, Dependencies, Epic, ReduxAction } from './types';

import { sortAssetArray } from './utils';
import { interval$ } from './price-feed';

export interface MarketAsset<T extends AssetSymbol> {
  name: T;
  icon: Lowercase<T> | null;
}
export interface MarketCollateral<T extends SelfMintingCollateralSymbol> {
  name: T;
  icon: Lowercase<T>;
}
export interface Market {
  pair?: string;
  collateralizationRatio?: StringAmount;
  liquidationRatio?: StringAmount;
  feePercentage?: StringAmount;
  capDepositRatio?: StringAmount;
  collateralRequirement?: StringAmount;
  capMintAmount?: StringAmount;
  positionCollateral?: StringAmount;
  positionTokens?: StringAmount;
  totalTokensOutstanding?: StringAmount;
  totalPositionCollateral?: StringAmount;
  positionWithdrawalRequestAmount?: StringAmount;
  positionWithdrawalRequestPassTimestamp?: number;
  price?: StringAmount;
}

export type OutputAction = ReduxAction<'markets/setMarketsList', Markets>;

export type InputAction = ReduxAction<'GET_MARKET_LIST', Empty> | OutputAction;

type Markets = {
  [Pair in SupportedSelfMintingPairExact]?: Market;
};

export const getActiveMarket = async (
  selfMintingRealmAgent: SelfMintingRealmAgent,
  pair: SupportedSelfMintingPairExact,
  chainLinkPriceFeed: ChainLinkPriceFeed,
): Promise<Markets> => {
  if (!selfMintingRealmAgent) {
    return {};
  }
  const realm = selfMintingRealmAgent!.activeDerivatives[pair]!;
  const data = {
    pair,
    liquidationRatio: getLiquidationRatio(realm.dynamic.collateralRequirement),
    feePercentage: realm.dynamic.feePercentage.toString() as StringAmount,
    capDepositRatio: realm.dynamic.capDepositRatio.toString() as StringAmount,
    capMintAmount: realm.dynamic.capMintAmount.toString() as StringAmount,
    collateralRequirement: realm.dynamic.collateralRequirement.toString() as StringAmount,
    positionCollateral: (await selfMintingRealmAgent.getPositionsData(
      pair,
    ))!.positionCollateral.toString() as StringAmount,
    positionTokens: (await selfMintingRealmAgent.getPositionsData(
      pair,
    ))!.positionTokens.toString() as StringAmount,
    positionWithdrawalRequestAmount: (await selfMintingRealmAgent.getPositionsData(
      pair,
    ))!.positionWithdrawalRequestAmount.toString() as StringAmount,
    positionWithdrawalRequestPassTimestamp: (await selfMintingRealmAgent.getPositionsData(
      pair,
    ))!.positionWithdrawalRequestPassTimestamp!,
    totalTokensOutstanding: realm.dynamic.totalTokensOutstanding.toString() as StringAmount,
    totalPositionCollateral: realm.dynamic.totalPositionCollateral.toString() as StringAmount,
    collateralizationRatio: calculateGCR(
      realm.dynamic.totalTokensOutstanding,
      realm.dynamic.totalPositionCollateral,
    ),
    price: (await chainLinkPriceFeed.getPrice(pair)) as StringAmount,
  };
  return {
    [pair]: data,
  };
};

export const getActiveMarkets = async ({
  selfMintingRealmAgent,
  chainLinkPriceFeed,
}: Context): Promise<Markets> => {
  if (!selfMintingRealmAgent) {
    return {};
  }
  try {
    const syntheticPairs = Object.entries(
      selfMintingRealmAgent!.activeDerivatives,
    );
    const assets: Market[] = await Promise.all(
      syntheticPairs.map(async ([pair_]) => {
        const pair = pair_ as SupportedSelfMintingPairExact;
        const data = await getActiveMarket(
          selfMintingRealmAgent,
          pair,
          chainLinkPriceFeed!,
        );
        return data[pair] as Market;
      }),
    );
    return Object.fromEntries(sortAssetArray(assets).map(a => [a.pair, a]));
  } catch (error) {
    return {};
  }
};

const currentPairs = new BehaviorSubject<SupportedSelfMintingPairExact>(
  'jCAD/UMA',
);

export const marketEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$: any,
  { context$ }: Dependencies,
) =>
  action$.pipe(
    filter(action => action.type === 'GET_MARKET_LIST'),
    tap(action => {
      switch (action.type) {
        case 'GET_MARKET_LIST':
          currentPairs.next(action.payload!);
          break;
        default:
          break;
      }
    }),
    switchMapTo(interval$),
    switchMapTo(currentPairs),
    switchMapTo(context$!),
    switchMap(
      async (context) => await getActiveMarkets(context), // eslint-disable-line
    ),
    map(results => ({
      type: 'markets/setMarketsList',
      payload: results,
    })),
  );
