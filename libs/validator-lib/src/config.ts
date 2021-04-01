import { SupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import {
  assertIsString,
  parseFiniteFloat,
  throwError,
} from '@jarvis-network/web3-utils/base/asserts';
import { typeCheck } from '@jarvis-network/web3-utils/base/meta';

export type LogLevels = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'FATAL' | 'TRACE';
const supportedLevels = typeCheck<LogLevels[]>()([
  'INFO',
  'DEBUG',
  'WARN',
  'ERROR',
  'FATAL',
  'TRACE',
] as const);

export function parseLogLevel(x: unknown): LogLevels {
  const levelName = assertIsString(x);
  const supported = supportedLevels as readonly string[];
  return supported.findIndex(s => levelName === s) !== -1
    ? (levelName as LogLevels)
    : throwError(
        `${x} is not supported. Supported level ids are: [${supported}]`,
      );
}

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
