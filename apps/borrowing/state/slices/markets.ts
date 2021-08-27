import { createSlice } from '@reduxjs/toolkit';
import { FlagKeys } from '@jarvis-network/ui';

import { addressSwitch, networkSwitch } from '@/state/actions';
import { initialAppState, State } from '@/state/initialState';
import {
  SupportedNetworkName,
  SupportedSelfMintingPairExact,
  SupportedSelfMintingSymbol,
} from '@jarvis-network/synthereum-config';
import {
  SyntheticSymbolOf,
  CollateralOf,
  SelfMintingCollateralSymbol,
  AssetFromSyntheticSymbol,
} from '@jarvis-network/synthereum-config';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

export type MarketAssetFlag = FlagKeys | null;
export interface MarketAsset<T extends SupportedSelfMintingSymbol> {
  name: T;
  icon: Lowercase<AssetFromSyntheticSymbol<T>> | null;
}
export interface MarketCollateral<T extends SelfMintingCollateralSymbol> {
  name: T;
  icon: Lowercase<T>;
}
export interface Market<
  Out extends SupportedSelfMintingSymbol = SupportedSelfMintingSymbol,
  In extends SelfMintingCollateralSymbol = SelfMintingCollateralSymbol
> {
  pair: `${Out}/${In}` | SupportedSelfMintingPairExact;
  readonly assetIn: MarketCollateral<In>;
  readonly assetOut: MarketAsset<Out>;
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
export type SelfMintingMarketAssets<
  Net extends SupportedNetworkName = SupportedNetworkName
> = {
  [Pair in SupportedSelfMintingPairExact<Net>]: Market<
    SyntheticSymbolOf<Pair>,
    CollateralOf<Pair>
  >;
};

interface Action<T> {
  payload: T;
}

const initialState = initialAppState.markets;

const marketsSlice = createSlice({
  name: 'markets',
  initialState,
  reducers: {
    setMarketsList(state, { payload: list }: Action<State['markets']['list']>) {
      const newMarketLists = list;

      for (const marketKey of Object.keys(newMarketLists)) {
        const newMarket =
          newMarketLists[marketKey as keyof typeof newMarketLists];

        if (!(marketKey in state.list)) {
          // Add new Market to the state:
          state.list[marketKey as keyof typeof state.list] = newMarket as any;
          continue;
        }

        const existingMarket = state.list[
          marketKey as keyof typeof state.list
        ]!;

        for (const key of Object.keys(existingMarket)) {
          (existingMarket as any)[key] = newMarket![
            key as keyof typeof newMarket
          ];
        }
      }
      // state.list['jCHF/UMA']= list['jCHF/UMA']
      // state.list['jCHF/UMA']!.assetIn = list['jCHF/UMA']!.assetIn!
      // state.list['jCHF/UMA']!.assetOut = list['jCHF/UMA']!.assetOut!
      // state.list['jCHF/UMA']!.capDepositRatio = list['jCHF/UMA']!.capDepositRatio!
      // state.list['jCHF/UMA']!.liquidationRatio = list['jCHF/UMA']!.liquidationRatio!
      // state.list['jCHF/UMA']!.positionCollateral = list['jCHF/UMA']!.positionCollateral!
      // state.list['jCHF/UMA']!.positionTokens = list['jCHF/UMA']!.positionTokens!
      // state.list['jCHF/UMA']!.collateralizationRatio = list['jCHF/UMA']!.collateralizationRatio!
      // state.list['jCHF/UMA']!.pair = list['jCHF/UMA']!.pair!

      // state.list['jCHF/UMA']?.assetIn = list['jCAD/UMA']?.assetIn
      // state.list['jCHF/USDC'] = list['jCHF/USDC']
      /// state.list['jEUR/UMA'] = list['jEUR/UMA']
      // state.list['jEUR/USDC'] = list['jEUR/USDC']
      // state.list['jGBP/UMA'] = list['jGBP/UMA']
      // state.list['jGBP/USDC'] = list['jGBP/USDC']
    },
    setMarketsManageKey(
      state,
      { payload: manageKey }: Action<State['markets']['manageKey']>,
    ) {
      return {
        ...state,
        manageKey,
      };
    },
    setMarketsFilterQuery(
      state,
      { payload: filterQuery }: Action<State['markets']['filterQuery']>,
    ) {
      return {
        ...state,
        filterQuery,
      };
    },
  },
  extraReducers: {
    [addressSwitch.type]() {
      return initialState;
    },
    [networkSwitch.type]() {
      return initialState;
    },
  },
});

export const {
  setMarketsList,
  setMarketsManageKey,
  setMarketsFilterQuery,
} = marketsSlice.actions;
export const { reducer } = marketsSlice;
