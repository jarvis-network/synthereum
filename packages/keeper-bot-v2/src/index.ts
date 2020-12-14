#!/usr/bin/env node

require('dotenv').config();
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { setPrivateKey_DevelopmentOnly } from '@jarvis-network/web3-utils/eth/web3-instance';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { env } from './config';
import SynFiatKeeper from './services/SynFiatKeeper';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config';

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.log(err);
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
  const realm = await getSynthereumRealmWithInfuraWeb3();
  const keeper = new SynFiatKeeper(realm, env);
  keeper.start();
  process.on('SIGINT', () => {
    keeper.stop();
  });
}
