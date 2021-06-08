import { logTable } from '@jarvis-network/core-utils/dist/logging';
import { assertIsAddress } from '@jarvis-network/core-utils/dist/eth/address';

import { arrayCliArg, buildCli } from './common/cli-config';
import { createCliApp } from './common/create-cli-app';

createCliApp(
  buildCli(__filename)
    .option('contracts', { type: 'string', array: true })
    .coerce('contracts', arg => arrayCliArg(arg).map(assertIsAddress)),
  async ({ web3, argv: { contracts = [] } }) => {
    const table = await Promise.all(
      contracts.map(async address => {
        const code = await web3.eth.getCode(address);
        const hash = web3.utils.soliditySha3(code);
        return { address, hash };
      }),
    );
    logTable(table);
  },
);
