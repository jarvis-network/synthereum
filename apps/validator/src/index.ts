#!/usr/bin/env node

require('dotenv').config();
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { setPrivateKey_DevelopmentOnly } from '@jarvis-network/web3-utils/eth/web3-instance';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { env } from './config';
import SynFiatKeeper from './services/SynFiatKeeper';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config';

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

async function getSynthereumRealmWithInfuraWeb3(): Promise<
  SynthereumRealmWithWeb3<SupportedNetworkName>
> {
  const netId = env.NETWORK_ID;
  const web3 = getInfuraWeb3(netId);
  setPrivateKey_DevelopmentOnly(web3, env.PRIVATE_KEY);
  return await loadRealm(web3, netId);
}

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
