#!/usr/bin/env node

import SynFiatKeeper from './services/SynFiatKeeper';
import { Web3Service } from '@jarvis/web3-utils';
require('dotenv').config();
import { env } from './config';

const web3 = new Web3Service(env.NETWORK_ID);
web3.setPrivateKey(env.PRIVATE_KEY);
const keeper = new SynFiatKeeper(web3, env);
(async () => {
  await keeper.loadContracts();
  keeper.start();
  process.on('SIGINT', () => {
    keeper.stop();
  });
})();
