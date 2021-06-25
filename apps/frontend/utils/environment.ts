import { parseSupportedNetworkId } from '@jarvis-network/synthereum-ts/dist/config';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';

export const getPriceFeedEndpoint = (): string =>
  process.env.NEXT_PUBLIC_PRICE_FEED_ROOT || 'wss://pricefeed.jarvis.exchange';

export const DEFAULT_NETWORK = parseSupportedNetworkId(
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK ?? Network.mainnet,
);
