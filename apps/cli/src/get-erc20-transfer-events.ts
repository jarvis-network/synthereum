import yargs from 'yargs';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import { getClosestBlock } from '@jarvis-network/core-utils/dist/eth/web3';
import { addDays } from '@jarvis-network/core-utils/dist/base/date-time-utils';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-ts/dist/config';
import { loadRealm } from '@jarvis-network/synthereum-ts/dist/core/load-realm';
import { assertIsAddress } from '@jarvis-network/core-utils/dist/eth/address';
import { Filter } from 'web3-eth-contract/types';
import {
  Amount,
  formatAmount,
  wei,
} from '@jarvis-network/core-utils/dist/base/big-number';

import {
  log,
  logTable,
  logError,
} from '@jarvis-network/core-utils/dist/logging';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { hideBin } = require('yargs/helpers');

const { argv } = yargs(hideBin(process.argv)).option('address', {
  type: 'string',
});

async function main() {
  log('Starting');
  const netId = parseSupportedNetworkId(42);
  const web3 = getInfuraWeb3(netId, 'wss');
  log('Getting starting block');
  const blockFrom250daysAgo = await getClosestBlock(
    web3,
    10000000,
    addDays(new Date(), -250).getTime() / 1000,
  );
  log('Got starting block:', { blockFrom250daysAgo });
  const realm = await loadRealm(web3, netId);
  log('Realm loaded:', { poolRegistry: realm.poolRegistry.address });
  const myAddress = assertIsAddress<42>(
    argv.address ?? '0x6e30001f52C69948066Afd91B417a988c543d3F1',
  );
  const fromBlock = blockFrom250daysAgo;
  const toBlock = 'latest';

  log('Getting ERC20 Transfer events for:', {
    address: myAddress,
    fromBlock,
    toBlock,
  });

  const filters = [
    {
      from: [myAddress as string],
    },
    {
      to: [myAddress as string],
    },
  ] as Filter[];

  const erc20 = assertNotNull(realm.pools.v2?.jEUR).collateralToken.instance;

  const events = (
    await Promise.all(
      filters.map(filter =>
        erc20.getPastEvents('Transfer', {
          filter,
          fromBlock,
          toBlock,
        }),
      ),
    )
  ).flatMap(x => x);

  const formatAddr = (addr: string) =>
    `0x${addr.slice(2, 6)}..${addr.slice(-4)}`;

  logTable(
    events.map(
      ({
        transactionHash,
        blockNumber,
        returnValues: { from, to, value },
      }) => ({
        blockNumber,
        from: formatAddr(from),
        to: formatAddr(to),
        value: `${formatAmount(wei(value).mul(wei(10 ** 12)) as Amount)} USDC`,
        transactionHash,
      }),
    ),
  );
}

main()
  .then(_ => process.exit(0))
  .catch(err => {
    logError(err);
    process.exit(1);
  });
