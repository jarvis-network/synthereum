import { weeks } from 'milliseconds';

import { SupportedSynthereumPair } from '@jarvis-network/synthereum-ts/dist/config';

import { formatDate } from '@jarvis-network/app-toolkit';

export type SubscriptionPair = SupportedSynthereumPair;

export type OHLC = [open: number, high: number, low: number, close: number];

export type PricesMap = { [key in SubscriptionPair]: number };

export type PriceUpdate = PricesMap & { t: string | number }; // @TODO Leave only single type for t after we decide

export type HistoricalPrices = { [key in SubscriptionPair]: OHLC[] } & {
  t: string[];
};

export type PriceMessage = PriceUpdate | HistoricalPrices;

export type Options = { includeHistory?: boolean };

export class PriceFeed {
  private socket: WebSocket | null = null;

  private queue: string[] = [];

  private subscriptions: SubscriptionPair[] = [];

  constructor(protected path: string) {}

  private connect = (): WebSocket => {
    this.socket = new WebSocket(`${this.path}/subscribe`);

    this.socket.addEventListener('open', this.sendQueueMessages);

    this.socket.addEventListener('close', () =>
      setTimeout(() => this.reconnect(), 5000),
    );

    return this.socket;
  };

  private reconnect = (): WebSocket => {
    this.subscriptions.forEach(this.resubscribePair);

    return this.connect();
  };

  private buildOptions = (
    options?: Options,
  ): Record<string, string> | undefined => {
    if (!options) {
      return;
    }

    const data: { [key: string]: string } = {};

    if (options.includeHistory) {
      data.to = formatDate(Date.now());
      data.from = formatDate(Date.now() - weeks(2));
    }

    return data;
  };

  private sendQueueMessages = () => {
    const { socket } = this;

    if (!socket) {
      return;
    }

    this.queue.forEach(message => socket.send(message));
    this.queue = [];
  };

  private sendMessage = (
    type: 'subscribe' | 'unsubscribe',
    pair: SubscriptionPair,
    options?: Options,
  ): WebSocket => {
    // Prepare message
    const message = JSON.stringify({
      type,
      pair,
      ...this.buildOptions(options),
    });

    // If socket channel read send message, if not save in queue to send later
    if (this.socket && this.socket.readyState === this.socket.OPEN) {
      this.socket.send(message);
    } else {
      this.queue.push(message);
    }

    // Return socket or cunnect()
    return this.socket || this.connect();
  };

  private unsubscribePair = (pair: SubscriptionPair): WebSocket =>
    this.sendMessage('unsubscribe', pair);

  private subscribePair = (
    pair: SubscriptionPair,
    options: Options,
  ): WebSocket => this.sendMessage('subscribe', pair, options);

  private resubscribePair = (pair: SubscriptionPair): WebSocket =>
    this.subscribePair(pair, {});

  subscribe = (asset: SupportedSynthereumPair, options: Options): WebSocket => {
    // Get subscription pair
    const pair: SubscriptionPair = asset;

    // If pair does exist subscriptions list just return socket
    if (this.socket && this.subscriptions.includes(pair)) {
      return this.socket;
    }

    // Save pair in subscriptions list
    this.subscriptions.push(pair);

    // Send subscribe message
    return this.subscribePair(pair, options);
  };

  subscribeMany = (
    assets: readonly SupportedSynthereumPair[],
    options: Options,
  ): WebSocket =>
    // Return last subscription result
    assets.map(asset => this.subscribe(asset, options))[assets.length - 1];

  unsubscribe = (pair: SubscriptionPair): WebSocket => {
    // If pair does not exist in subscriptions list just return socket
    if (this.socket && !this.subscriptions.includes(pair)) {
      return this.socket;
    }

    // Remove pair from subscriptions list
    this.subscriptions.splice(this.subscriptions.indexOf(pair), 1);

    // Send unsubscribe message
    return this.unsubscribePair(pair);
  };

  closeConnection = () => {
    // Unsubscribe
    if (this.subscriptions && this.subscriptions.length) {
      this.subscriptions.forEach(this.unsubscribePair);
    }

    // Just return if socket does not exist
    if (!this.socket) {
      return;
    }

    this.socket.close();
    this.socket = null;
  };
}
