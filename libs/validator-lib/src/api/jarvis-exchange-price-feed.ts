import { URLSearchParams } from 'url';

import WebSocket from 'ws';
import { isFinite } from '@jarvis-network/core-utils/dist/base/asserts';
import axios from 'axios';

import { priceFeed as priceFeedPairsMap } from '@jarvis-network/synthereum-contracts/dist/src/config';

import { env } from '../config';

const pairs = Object.values(priceFeedPairsMap);

export type Pair = typeof pairs[0];
type OHLC = [open: number, high: number, low: number, close: number];
type PricesMap = { [key in Pair]: number };
type PriceUpdate = PricesMap & { t?: number };
type HistoricalPrices = { [key in Pair]: OHLC[] } & {
  t?: string[];
};
type PriceMessage = PriceUpdate | HistoricalPrices;

interface Cache {
  [timestamp: string]: number;
}

type CachedPairs = {
  [key in Pair]: Cache;
};

const cleanCache = () =>
  pairs.reduce((accumulator, pair) => {
    accumulator[pair] = {};
    return accumulator;
  }, {} as CachedPairs);

export class PriceFeed {
  cache = cleanCache();

  interval?: ReturnType<typeof setInterval>;

  private ws?: WebSocket;

  connect() {
    if (this.ws) throw new Error('connect already called');

    this.ws = new WebSocket(
      `${env.PRICE_FEED_API.replace(
        /^http/,
        'ws',
      )}/subscribe?pairs=${pairs.join(',')}`,
    );
    this.ws.addEventListener('message', event => {
      try {
        const message = JSON.parse(event.data) as PriceMessage;
        if (typeof message.t === 'number') {
          const { t } = message;
          delete message.t;
          for (const i in message) {
            if (!Object.prototype.hasOwnProperty.call(message, i)) continue;
            const price = (message as PriceUpdate)[i as Pair];
            this.cache[i as Pair][t] = i === 'USDCHF' ? 1 / price : price;
          }
        }
      } catch (exception) {
        console.error(exception);
      }
    });
    this.ws.addEventListener('error', console.error);
    this.ws.addEventListener('close', () => {
      delete this.ws;
      this.cache = cleanCache();
      clearInterval(this.interval!);
      setTimeout(() => {
        this.connect();
      }, 5000);
    });

    clearInterval(this.interval!);
    this.interval = setInterval(() => {
      // Clean entries older than every hour
      const timestamp = Math.round(Date.now() / 1000 - 60 * 60).toString();
      for (const i in this.cache) {
        if (!Object.prototype.hasOwnProperty.call(this.cache, i)) continue;
        const cache = this.cache[i as Pair];

        for (const key of Object.keys(cache).filter(k => k < timestamp)) {
          delete cache[key];
        }
      }
    }, 30 * 60 * 1000);
  }

  disconnect() {
    this.ws?.close();
    clearInterval(this.interval!);
    delete this.ws;
  }

  async getPrice(pair: Pair, timestamp: string) {
    const cached = this.cache[pair][
      Object.keys(this.cache[pair])
        .filter(key => timestamp > key)
        .sort()[0]
    ];
    if (cached) return cached;

    const query = new URLSearchParams({ pair, timestamp });
    const { price } = (
      await axios.get<{ price: number; t: number }>(
        `${env.PRICE_FEED_API}/price?${query.toString()}`,
      )
    ).data;
    if (!isFinite(price)) return 0;
    return pair === 'USDCHF' ? 1 / price : price;
  }
}
