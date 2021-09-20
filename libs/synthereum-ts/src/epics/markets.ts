import {
  SupportedSelfMintingPairExact,
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
  takeUntil,
} from 'rxjs';

import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { Empty } from '@jarvis-network/core-utils/dist/base/optional';

import { calculateGCR } from '../core/realms/self-minting/utils';

import { SelfMintingRealmAgent } from '../core/realms/self-minting/agent';

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
  address?: string;
  collateralTokenDecimals?: number;
  syntheticTokenDecimals?: number;
}

export type OutputAction = ReduxAction<'markets/setMarketsList', Markets>;

export type InputAction = ReduxAction<'GET_MARKET_LIST', Empty> | OutputAction;

export type Markets = {
  [Pair in SupportedSelfMintingPairExact]?: Market;
};

export const getActiveMarket = async (
  selfMintingRealmAgent: SelfMintingRealmAgent,
  pair: SupportedSelfMintingPairExact,
): Promise<Markets> => {
  if (!selfMintingRealmAgent) {
    return {};
  }
  const realm = selfMintingRealmAgent!.activeDerivatives[pair]!;
  const [getPositionsData] = await Promise.all([
    selfMintingRealmAgent.getPositionsData(pair),
  ]);
  const data = {
    pair,
    liquidationRatio: realm.dynamic.collateralRequirement.toString() as StringAmount,
    feePercentage: realm.dynamic.feePercentage.toString() as StringAmount,
    capDepositRatio: realm.dynamic.capDepositRatio.toString() as StringAmount,
    capMintAmount: realm.dynamic.capMintAmount.toString() as StringAmount,
    collateralRequirement: realm.dynamic.collateralRequirement.toString() as StringAmount,
    positionCollateral: getPositionsData.positionCollateral.toString() as StringAmount,
    positionTokens: getPositionsData.positionTokens.toString() as StringAmount,
    positionWithdrawalRequestAmount: getPositionsData.positionWithdrawalRequestAmount.toString() as StringAmount,
    positionWithdrawalRequestPassTimestamp: getPositionsData.positionWithdrawalRequestPassTimestamp!,
    totalTokensOutstanding: realm.dynamic.totalTokensOutstanding.toString() as StringAmount,
    totalPositionCollateral: realm.dynamic.totalPositionCollateral.toString() as StringAmount,
    collateralizationRatio: calculateGCR(
      realm.dynamic.totalTokensOutstanding,
      realm.dynamic.totalPositionCollateral,
    ),
    address: realm.static.address,
    collateralTokenDecimals: realm.static.collateralToken.decimals,
    syntheticTokenDecimals: realm.static.syntheticToken.decimals,
  };
  return {
    [pair]: data,
  };
};

export const getActiveMarkets = async ({
  selfMintingRealmAgent,
}: Partial<Context>): Promise<Markets> => {
  if (!selfMintingRealmAgent) {
    return {};
  }
  try {
    const syntheticPairs = Object.entries(
      selfMintingRealmAgent!.activeDerivatives,
    );
    const assetsArray = await Promise.all(
      syntheticPairs.map(([pair_]) => {
        const pair = pair_ as SupportedSelfMintingPairExact;
        return getActiveMarket(selfMintingRealmAgent, pair);
      }),
    );
    const assets = assetsArray.flatMap(a => Object.values(a));

    return Object.fromEntries(sortAssetArray(assets).map(a => [a.pair, a]));
  } catch (error) {
    return {};
  }
};

const currentPairs = new BehaviorSubject<SupportedSelfMintingPairExact>(
  'jEUR/UMA',
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
    switchMap(_ =>
      context$!.pipe(
        map(context => ({
          context,
        })),
        takeUntil(
          action$.pipe(
            filter(
              a => a.type === 'networkSwitch' || a.type === 'addressSwitch',
            ),
          ),
        ),
      ),
    ),

    switchMap(
      async ({context}) => await getActiveMarkets(context), // eslint-disable-line
    ),
    map(results => ({
      type: 'markets/setMarketsList',
      payload: results,
    })),
  );
