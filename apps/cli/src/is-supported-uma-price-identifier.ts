import {
  parseSupportedNetworkId,
  synthereumConfig,
} from '@jarvis-network/synthereum-ts/dist/config';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import {
  log,
  logError,
  logTable,
} from '@jarvis-network/core-utils/dist/logging';
import { getContract } from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import { IdentifierWhitelist_Abi } from '@jarvis-network/synthereum-contracts/dist/src/contracts/abi';
import { utf8ToHex } from 'web3-utils';
import { networkIdToName } from '@jarvis-network/core-utils/dist/eth/networks';

import { buildCli } from './common/cli-config';

const { argv } = buildCli(__filename).option('identifiers', {
  array: true,
  type: 'string',
  coerce: (x: string[] | undefined) =>
    Array.isArray(x) && x.length === 1 && x[0].indexOf(',') > 0
      ? x[0].split(',')
      : x,
});

async function main() {
  const netId = parseSupportedNetworkId(argv.network);
  const web3 = getInfuraWeb3(netId);

  log('web3 instance connected to:', networkIdToName[netId]);

  const address =
    synthereumConfig[netId].contractsDependencies.uma.identifierWhitelist;
  const identifierWhitelist = getContract(
    web3,
    IdentifierWhitelist_Abi,
    address,
  );

  log('Created IdentifierWhitelist contract instance at:', address);

  const getInfo = async (identifier: string) => ({
    id: identifier,
    value: utf8ToHex(identifier),
    isSupported: await identifierWhitelist.instance.methods
      .isIdentifierSupported(utf8ToHex(identifier))
      .call(),
  });

  const pairs =
    argv.identifiers && argv.identifiers.length > 0
      ? argv.identifiers
      : ['EUR/USD', 'GBP/USD', 'CHF/USD', 'XAU/USD'];

  const data = await Promise.all(
    pairs
      .map(id => [id, id.replace('/', '')])
      .flat()
      .map(getInfo),
  );
  logTable(data);
}

main()
  .then(_ => process.exit(0))
  .catch(err => {
    logError(err);
    process.exit(1);
  });
