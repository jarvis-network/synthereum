import {
  assertIsString,
  parseFiniteFloat,
} from '@jarvis-network/web3-utils/base/asserts';
import { LogLevels, parseLogLevel } from './log';

const { MAX_SLIPPAGE, LOG_LEVEL, PRICE_FEED_API, LOGS_PATH } = process.env;

export interface ENV {
  MAX_SLIPPAGE: number;
  LOG_LEVEL: LogLevels;
  PRICE_FEED_API: string;
  LOGS_PATH: string;
}

export const env: ENV = {
  MAX_SLIPPAGE: parseFiniteFloat(MAX_SLIPPAGE),
  LOG_LEVEL: parseLogLevel(LOG_LEVEL),
  PRICE_FEED_API: assertIsString(PRICE_FEED_API),
  LOGS_PATH: assertIsString(LOGS_PATH),
};
