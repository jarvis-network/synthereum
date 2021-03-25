import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config';

export const NETWORK_ID = parseSupportedNetworkId(
  Number(process.env.NEXT_PUBLIC_NETWORK_ID) || 42,
);
