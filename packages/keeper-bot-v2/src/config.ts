import { base } from '@jarvis-network/web3-utils';
import { eth } from '@jarvis-network/web3-utils';
const { assertIsString, parseInteger, parseFiniteFloat } = base.asserts;

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
  NETWORK_ID: eth.networks.NetworkId;
}

export const env: ENV = {
  FREQUENCY: parseInteger(FREQUENCY),
  PRIVATE_KEY: assertIsString(PRIVATE_KEY),
  MAX_SLIPPAGE: parseFiniteFloat(MAX_SLIPPAGE),
  LOG_LEVEL: assertIsString(LOG_LEVEL),
  NETWORK_ID: eth.networks.assertIsNetworkId(parseInteger(NETWORK_ID)),
};
