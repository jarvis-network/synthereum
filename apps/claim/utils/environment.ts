import { Network } from '@jarvis-network/core-utils/dist/eth/networks';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/config';

export const DEFAULT_NETWORK = parseSupportedNetworkId(
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK ?? Network.mainnet,
);
