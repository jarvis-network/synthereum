import {
  parseSupportedNetworkId,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import {
  env as validatorLibenv,
  ENV as validatorLibENV,
} from '@jarvis-network/validator-lib';
import {
  assertIsString,
  parseInteger,
} from '@jarvis-network/web3-utils/base/asserts';
const { FREQUENCY, PRIVATE_KEY, NETWORK_ID } = process.env;

export interface ENV extends validatorLibENV {
  FREQUENCY: number;
  PRIVATE_KEY: string;
  NETWORK_ID: SupportedNetworkId;
}

export const env: ENV = {
  FREQUENCY: parseInteger(FREQUENCY),
  PRIVATE_KEY: assertIsString(PRIVATE_KEY),
  NETWORK_ID: parseSupportedNetworkId(NETWORK_ID),
  ...validatorLibenv,
};
