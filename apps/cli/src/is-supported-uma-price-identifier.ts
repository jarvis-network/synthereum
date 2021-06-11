import { synthereumConfig } from '@jarvis-network/synthereum-ts/dist/config';
import { log, logTable } from '@jarvis-network/core-utils/dist/logging';
import { getContract } from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import { IdentifierWhitelist_Abi } from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import { utf8ToHex } from 'web3-utils';

import { arrayCliArg, buildCli } from './common/cli-config';
import { createCliApp } from './common/create-cli-app';

createCliApp(
  buildCli(__filename).option('identifiers', {
    array: true,
    type: 'string',
    coerce: x => arrayCliArg(x),
  }),
  async ({ web3, netId, argv: { identifiers } }) => {
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
      identifiers && identifiers.length > 0
        ? identifiers
        : ['EUR/USD', 'GBP/USD', 'CHF/USD', 'XAU/USD'];

    const data = await Promise.all(
      pairs
        .map(id => [id, id.replace('/', '')])
        .flat()
        .map(getInfo),
    );
    logTable(data);
  },
);
