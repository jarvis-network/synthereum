#!/usr/bin/env node

require('dotenv').config();
import { getSynthereumRealmWithInfuraWeb3 } from '@jarvis-network/validator-lib';
import { env } from './config';
import SynFiatKeeper from './services/SynFiatKeeper';

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled promise rejection: ', p, 'reason:', reason);
  process.exit(13);
});

main()
  .then(() => {
    console.log('Synthereum Validator exiting');
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

async function main() {
  console.log('Synthereum Validator starting');
  const realm = await getSynthereumRealmWithInfuraWeb3();
  console.log('Synthereum Realm loaded');
  const keeper = new SynFiatKeeper(realm, env);
  keeper.start();
  process.on('SIGINT', () => {
    keeper.stop();
  });
}
