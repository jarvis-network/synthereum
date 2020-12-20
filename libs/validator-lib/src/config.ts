import { SupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import {
  assertIsString,
  parseFiniteFloat,
} from '@jarvis-network/web3-utils/base/asserts';
import { LogLevels, parseLogLevel } from './log';

const {
  MAX_SLIPPAGE,
  LOG_LEVEL,
  PRICE_FEED_API,
  LOGS_PATH,
  PRIVATE_KEY,
  NETWORK_ID,
} = process.env;

export interface ENV {
  MAX_SLIPPAGE: number;
  LOG_LEVEL: LogLevels;
  PRICE_FEED_API: string;
  PRIVATE_KEY: string;
  NETWORK_ID: SupportedNetworkId;
  LOGS_PATH: string;
}

export const env: ENV = {
  MAX_SLIPPAGE: parseFiniteFloat(MAX_SLIPPAGE),
  LOG_LEVEL: parseLogLevel(LOG_LEVEL),
  PRICE_FEED_API: assertIsString(PRICE_FEED_API),
  PRIVATE_KEY: assertIsString(PRIVATE_KEY),
  NETWORK_ID: parseSupportedNetworkId(NETWORK_ID),
  LOGS_PATH: assertIsString(LOGS_PATH),
};
