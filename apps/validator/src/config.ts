import {
  assertIsString,
  parseFiniteFloat,
  parseInteger,
} from '@jarvis-network/web3-utils/base/asserts';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { SupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';

const {
  FREQUENCY,
  PRIVATE_KEY,
  MAX_SLIPPAGE,
  LOG_LEVEL,
  NETWORK_ID,
} = process.env;

export interface ENV {
  FREQUENCY: number;
  PRIVATE_KEY: string;
  MAX_SLIPPAGE: number;
  LOG_LEVEL: string;
  NETWORK_ID: SupportedNetworkId;
}

export const env: ENV = {
  FREQUENCY: parseInteger(FREQUENCY),
  PRIVATE_KEY: assertIsString(PRIVATE_KEY),
  MAX_SLIPPAGE: parseFiniteFloat(MAX_SLIPPAGE),
  LOG_LEVEL: assertIsString(LOG_LEVEL),
  NETWORK_ID: parseSupportedNetworkId(NETWORK_ID),
};
