require('dotenv').config();
import yargs from 'yargs';
const { hideBin } = require('yargs/helpers');
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { getClosestBlock } from '@jarvis-network/web3-utils/eth/web3';
import { addDays } from '@jarvis-network/web3-utils/base/date-time-utils';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';
import { Filter } from 'web3-eth-contract/types';
import {
  Amount,
  formatAmount,
  wei,
} from '@jarvis-network/web3-utils/base/big-number';
import { console, log } from './utils/log';

const argv = yargs(hideBin(process.argv)).option('address', {
  type: 'string',
}).argv;

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

  const erc20 = realm.pools.v2.jEUR.collateralToken.instance;

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

  console.table(
    events.map(
      ({
        transactionHash,
        blockNumber,
        returnValues: { from, to, value },
      }) => ({
        blockNumber,
        from: formatAddr(from),
        to: formatAddr(to),
        value: formatAmount(wei(value).mul(wei(10 ** 12)) as Amount) + ' USDC',
        transactionHash,
      }),
    ),
  );
}

main()
  .then(_ => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1);
  });
