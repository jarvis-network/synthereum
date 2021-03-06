import { SupportedNetworkName } from '@jarvis-network/synthereum-ts/dist/config';
import { loadRealm } from '@jarvis-network/synthereum-ts/dist/core/load-realm';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-ts/dist/core/types/realm';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import { setPrivateKey_DevelopmentOnly } from '@jarvis-network/core-utils/dist/eth/web3-instance';

import { env } from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

export function getSynthereumRealmWithInfuraWeb3(): Promise<
  SynthereumRealmWithWeb3<SupportedNetworkName>
> {
  const netId = env.NETWORK_ID;
  const web3 = getInfuraWeb3(netId);
  setPrivateKey_DevelopmentOnly(web3, env.PRIVATE_KEY);
  return loadRealm(web3, netId);
}
