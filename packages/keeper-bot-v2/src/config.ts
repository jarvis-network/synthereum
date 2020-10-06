import { NetworkName } from '@jarvis/web3-utils';

const {
  RPC_HOST,
  FREQUENCY,
  PRIVATE_KEY,
  MAX_SLIPPAGE,
  LOG_LEVEL,
  NETWORK_ID,
} = process.env;

interface ENV {
  RPC_HOST: string;
  FREQUENCY: string;
  PRIVATE_KEY: string;
  MAX_SLIPPAGE: string;
  LOG_LEVEL: string;
  NETWORK_ID: NetworkName;
}

export const env: ENV = {
  RPC_HOST,
  FREQUENCY,
  PRIVATE_KEY,
  MAX_SLIPPAGE,
  LOG_LEVEL,
  NETWORK_ID: NETWORK_ID as NetworkName, // TODO: validate input
};
