import { createAction, createSlice } from '@reduxjs/toolkit';

import { reversedPriceFeedPairs } from '@jarvis-network/synthereum-contracts/dist/src/config/data/price-feed';

import { initialState, PricePoint } from '@/state/initialState';
import { formatDate } from '@/utils/format';
import {
  PriceUpdate,
  HistoricalPrices,
  SubscriptionPair,
} from '@/utils/priceFeed';

export interface SavePricePointsAction<T> {
  type: string;
  payload: T;
}

const isPairReversed = (pair: SubscriptionPair) =>
  reversedPriceFeedPairs.includes(pair);

const pricesSlice = createSlice({
  name: 'prices',
  initialState: initialState.prices,
  reducers: {
    saveCachedHistory(
      _,
      { payload }: SavePricePointsAction<typeof initialState.prices>,
    ) {
      // Override prices state by cached data as cache should store latest valid value
      return payload;
    },
    addHistory(
      state,
      { payload: { t, ...map } }: SavePricePointsAction<HistoricalPrices>,
    ) {
      // Get subscribed pairs keys
      const pairs = Object.keys(map) as SubscriptionPair[];

      // Save history data for each pair in map
      for (const pair of pairs) {
        if (!state.feed[pair]) {
          // eslint-disable-next-line no-param-reassign
          state.feed[pair] = [];
        }

        // Get values array for pair
        const values = map[pair];

        // Iterate in t, each index describe time point for pair
        // Sort t to check lower timestamp earlier to not sort values later
        for (const index in t) {
          const rawValue = values[index];
          const time = t[index];
          const [open, high, low, close] = isPairReversed(pair)
            ? rawValue.map(v => 1 / v)
            : rawValue;

          // Build time point value
          const timeValue: PricePoint = {
            time,
            open,
            high,
            low,
            close,
            history: true,
          };

          // If time exist in redux - override, if not - push to array
          const timeIndex = state.feed[pair].findIndex(_i => _i.time === time);

          if (timeIndex < 0) {
            state.feed[pair].push(timeValue);
          } else {
            // eslint-disable-next-line no-param-reassign
            state.feed[pair][timeIndex] = timeValue;
          }
        }
      }
    },
    addPriceUpdate(
      state,
      { payload: { t, ...map } }: SavePricePointsAction<PriceUpdate>,
    ) {
      // Get subscribed pairs keys
      const pairs = Object.keys(map) as SubscriptionPair[];

      // Build time based on timestamp value
      const time = typeof t === 'string' ? t : formatDate(t * 1000); // @TODO Leave only single var after we decide; if t is number it is timestamp in seconds

      // Iterate in pairs list to save new price point
      for (const pair of pairs) {
        // Omit if historical data does not exist yet
        if (!state.feed[pair] || !state.feed[pair].length) {
          // eslint-disable-next-line no-continue
          continue;
        }

        // Latest value for pair
        const rawValue = map[pair];
        const value = isPairReversed(pair) ? 1 / rawValue : rawValue;

        // Saved time point for pair
        const timeIndex = state.feed[pair].findIndex(_i => _i.time === time);

        // If new day clone old value
        const oldTimeIndex =
          timeIndex < 0 ? state.feed[pair].length - 1 : timeIndex;

        // Handle new price point
        if (timeIndex < 0) {
          // Set latest item as historical
          // eslint-disable-next-line no-param-reassign
          state.feed[pair][oldTimeIndex].history = true;

          // If we need to push new value we need to reset item to current value
          state.feed[pair].push({
            time,
            open: value,
            high: value,
            low: value,
            close: value,
            history: true,
          });

          // eslint-disable-next-line no-continue
          continue;
        }

        // Build new time point for pair base on price update
        const timeValue: PricePoint = {
          ...state.feed[pair][oldTimeIndex],
          time,
          close: value,
          history: false,
        };

        // Update highest value if needed
        if (value > timeValue.high) {
          timeValue.high = value;
        }

        // Update lowest value if needed
        if (value < timeValue.low) {
          timeValue.low = value;
        }

        // eslint-disable-next-line no-param-reassign
        state.feed[pair][timeIndex] = timeValue;
      }
    },
  },
});

export const closeConnection = createAction('PRICE_FEED_CLOSE');
export const subscribeAllPrices = createAction('PRICE_FEED_SUBSCRIBE');

export const {
  saveCachedHistory,
  addHistory,
  addPriceUpdate,
} = pricesSlice.actions;

export const { reducer } = pricesSlice;
