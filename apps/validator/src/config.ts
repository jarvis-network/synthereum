import {
  env as validatorLibenv,
  ENV as validatorLibENV,
} from '@jarvis-network/validator-lib';
import { parseInteger } from '@jarvis-network/web3-utils/base/asserts';
const { FREQUENCY } = process.env;

export interface ENV extends validatorLibENV {
  FREQUENCY: number;
}

export const env: ENV = {
  FREQUENCY: parseInteger(FREQUENCY),

  ...validatorLibenv,
};
