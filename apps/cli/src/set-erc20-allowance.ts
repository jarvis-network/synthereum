/* eslint-disable import/first */
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { parseSupportedNetworkId } from '@jarvis-network/synthereum-ts/dist/src/config';
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import {
  assertNotNull,
  parseInteger,
} from '@jarvis-network/web3-utils/base/asserts';
import { setMaxTokenAllowance } from '@jarvis-network/web3-utils/eth/contracts/erc20';
import {
  NetworkName,
  setPrivateKey_DevelopmentOnly,
  Web3On,
} from '@jarvis-network/web3-utils/eth/web3-instance';
import { log } from '@jarvis-network/web3-utils/logging';
import { ERC20_Abi } from '@jarvis-network/synthereum-contracts/dist/src/contracts/abi';

import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import { TokenInfo } from '@jarvis-network/web3-utils/eth/contracts/types';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { sendTxAndLog } from '@jarvis-network/web3-utils/eth/contracts/send-tx';

main()
  .then(_ => process.exit(0))
  .catch(err => {
    log(err);
    process.exit(1);
  });

async function main() {
  log('Starting');
  const netId = parseSupportedNetworkId(process.env.NETWORK_ID);
  const web3 = getInfuraWeb3(netId);
  log('Web3 instance loaded');
  setPrivateKey_DevelopmentOnly(web3, assertNotNull(process.env.PRIVATE_KEY));
  const from = web3.defaultAccount as AddressOn<NetworkName>;
  log('Private key set - using', { address: from });

  const token = await getTokenInfo(
    web3,
    '0x85e2565d4be13b952781317d8f62c8175e9bdbc7' as any,
  );
  await sendTxAndLog(
    setMaxTokenAllowance(
      token,
      '0x3cc6087254852fbf49913c52b6b1a7d7ec401b82' as any,
    ),
    { printInfo: { log }, web3, from },
  );

  log('All done');
}

async function getTokenInfo<Net extends NetworkName>(
  web3: Web3On<Net>,
  address: AddressOn<Net>,
): Promise<TokenInfo<Net>> {
  const { instance } = getContract(web3, ERC20_Abi, address);
  const symbol = await instance.methods.symbol().call();
  const decimals = parseInteger(await instance.methods.decimals().call());
  return {
    address,
    instance,
    symbol,
    decimals,
  };
}
