#!/usr/bin/env node

require('dotenv').config();
import { getSynthereumRealmWithInfuraWeb3 } from '@jarvis-network/validator-lib';
import { env } from './config';
import SynFiatKeeper from './services/SynFiatKeeper';
main()
  .then(() => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1);
  });

async function main() {
  const realm = await getSynthereumRealmWithInfuraWeb3();
  const keeper = new SynFiatKeeper(realm, env);
  keeper.start();
  process.on('SIGINT', () => {
    keeper.stop();
  });
}
