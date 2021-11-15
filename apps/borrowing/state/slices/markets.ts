import { createSlice } from '@reduxjs/toolkit';

import {
  networkSwitchAction,
  logoutAction,
  addressSwitchAction,
} from '@jarvis-network/app-toolkit/dist/sharedActions';
import { initialAppState, State } from '@/state/initialState';
import {
  SupportedNetworkName,
  SupportedSelfMintingPairExact,
  SupportedSelfMintingSymbol,
  SyntheticSymbolOf,
  CollateralOf,
  SelfMintingCollateralSymbol,
} from '@jarvis-network/synthereum-config';

import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

export interface MarketAsset<T extends SupportedSelfMintingSymbol> {
  name: T;
}
export interface MarketCollateral<T extends SelfMintingCollateralSymbol> {
  name: T;
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
  minSponsorTokens?: StringAmount;
  positionWithdrawalRequestPassTimestamp?: number;
  price?: StringAmount;
  address?: string;
  agentAddress?: string | null;
  collateralTokenDecimals?: number;
  syntheticTokenDecimals?: number;
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
    [addressSwitchAction.type]() {
      return initialState;
    },
    [networkSwitchAction.type]() {
      return initialState;
    },
    [logoutAction.type]() {
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
