#!/usr/bin/env node

import {
  createEverLogger,
  getSynthereumRealmWithInfuraWeb3,
} from '@jarvis-network/validator-lib';

import { env } from './config';
import SynFiatKeeper from './services/SynFiatKeeper';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

const logger = createEverLogger({
  name: 'validator',
});

process.on('unhandledRejection', (reason, p) => {
  logger.error('Unhandled promise rejection: ', p, 'reason:', reason);
  process.exit(13);
});

main().catch(err => {
  logger.error(err);
  logger.warn('Synthereum Validator exiting');
  process.exit(1);
});

async function main() {
  logger.info('Synthereum Validator starting');
  const realm = await getSynthereumRealmWithInfuraWeb3();
  logger.info('Synthereum Realm loaded');
  const keeper = new SynFiatKeeper(logger, realm, env);
  keeper.start();
  process.on('SIGINT', () => {
    keeper.stop();
  });
}
