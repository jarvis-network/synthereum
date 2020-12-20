require('dotenv').config();
import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { setPrivateKey_DevelopmentOnly } from '@jarvis-network/web3-utils/eth/web3-instance';
import { env } from './config';

export async function getSynthereumRealmWithInfuraWeb3(): Promise<
  SynthereumRealmWithWeb3<SupportedNetworkName>
> {
  const netId = env.NETWORK_ID;
  const web3 = getInfuraWeb3(netId);
  setPrivateKey_DevelopmentOnly(web3, env.PRIVATE_KEY);
  return loadRealm(web3, netId);
}
