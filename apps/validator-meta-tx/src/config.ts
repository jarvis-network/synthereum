import {
  env as validatorLibenv,
  ENV as validatorLibENV,
} from '@jarvis-network/validator-lib';
import { assertIsString } from '@jarvis-network/web3-utils/base/asserts';
const { PORT, HOST, NODE_ENV } = process.env;

export interface ENV extends validatorLibENV {
  PORT: number;
  HOST: string;
  NODE_ENV: string;
}
export const env: ENV = {
  PORT: parseInt(PORT as string),
  HOST: assertIsString(HOST),
  NODE_ENV: assertIsString(NODE_ENV),
  ...validatorLibenv,
};
