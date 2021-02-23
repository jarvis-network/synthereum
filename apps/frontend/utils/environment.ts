import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

export const getPriceFeedEndpoint = () =>
  process.env.NEXT_PUBLIC_PRICE_FEED_ROOT || 'wss://pricefeed.jarvis.exchange';

export const MAX_MINT_VALUE = new FPN(
  process.env.NEXT_PUBLIC_MAX_MINT_VALUE || 500,
);
