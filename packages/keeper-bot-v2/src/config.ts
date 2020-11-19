import { NetworkName } from '@jarvis-network/web3-utils';

const {
  FREQUENCY,
  PRIVATE_KEY,
  MAX_SLIPPAGE,
  LOG_LEVEL,
  NETWORK_ID,
} = process.env;

export interface ENV {
  FREQUENCY: string;
  PRIVATE_KEY: string;
  MAX_SLIPPAGE: string;
  LOG_LEVEL: string;
  NETWORK_ID: NetworkName;
}

export const env: ENV = {
  FREQUENCY,
  PRIVATE_KEY,
  MAX_SLIPPAGE,
  LOG_LEVEL,
  NETWORK_ID: NETWORK_ID as NetworkName, // TODO: validate input
};
