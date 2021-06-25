import { assertIsSupportedPoolVersion } from '@jarvis-network/synthereum-ts/dist/core/types/pools';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-ts/dist/config';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';

export const getPriceFeedEndpoint = (): string =>
  process.env.NEXT_PUBLIC_PRICE_FEED_ROOT || 'wss://pricefeed.jarvis.exchange';

assertIsSupportedPoolVersion(process.env.NEXT_PUBLIC_POOL_VERSION || 'v4');

export const DEFAULT_NETWORK = parseSupportedNetworkId(
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK ?? Network.mainnet,
);
