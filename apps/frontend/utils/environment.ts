import { assertIsSupportedPoolVersion } from '@jarvis-network/synthereum-contracts/dist/src/core/types/pools';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

export const getPriceFeedEndpoint = () =>
  process.env.NEXT_PUBLIC_PRICE_FEED_ROOT || 'wss://pricefeed.jarvis.exchange';

export const MAX_MINT_VALUE = new FPN(
  process.env.NEXT_PUBLIC_MAX_MINT_VALUE || 500,
);

assertIsSupportedPoolVersion(process.env.NEXT_PUBLIC_POOL_VERSION || 'v1');

export const NETWORK_ID = parseSupportedNetworkId(
  Number(process.env.NEXT_PUBLIC_NETWORK_ID) || 42,
);
