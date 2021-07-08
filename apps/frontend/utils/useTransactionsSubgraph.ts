import { assetsObject } from '@/data/assets';
import { SynthereumTransaction, TransactionIO } from '@/data/transactions';
import {
  addTransactions,
  fetchAndStoreMoreTransactions,
  updateTranasactionStatus,
} from '@/state/slices/transactions';
import { useReduxSelector } from '@/state/useReduxSelector';
import {
  checkIsSupportedNetwork,
  primaryCollateralSymbol,
  SupportedNetworkId,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-ts/dist/src/config';
import {
  PoolVersion,
  SynthereumPool,
} from '@jarvis-network/synthereum-ts/dist/src/core/types/pools';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import {
  TransactionHash,
  TransactionStatus,
} from '@jarvis-network/core-utils/dist/eth/transaction';
import { TokenInfo } from '@jarvis-network/core-utils/dist/eth/contracts/types';
import {
  networkIdToName,
  NetworkName,
} from '@jarvis-network/core-utils/dist/eth/networks';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  useCoreObservables,
  useBehaviorSubject,
} from '@jarvis-network/app-toolkit';

import { dbPromise, DB } from './db';

export const transactionsSubgraphUrls = {
  mainnet:
    'https://api.thegraph.com/subgraphs/name/dimitarnestorov/synthereum-transactions',
  kovan:
    'https://api.thegraph.com/subgraphs/name/dimitarnestorov/synthereum-transactions-kovan',
};

type ResponseTransaction = {
  id: TransactionHash;
  inputTokenAddress: Address;
  inputTokenAmount: string;
  outputTokenAddress: Address;
  outputTokenAmount: string;
  timestamp: string; // Seconds
  block: string; // The block number
  type: 'mint' | 'redeem' | 'exchange';
};

type TheGraphTransactionsSubgraphResponse = {
  data?: {
    transactions: ResponseTransaction[];
  };
  error?: string;
};

const poolVersion = process.env.NEXT_PUBLIC_POOL_VERSION as PoolVersion;

export function useTransactionsSubgraph() {
  const { networkId$, realmAgent$ } = useCoreObservables();
  const networkId = useBehaviorSubject(networkId$);
  const realmAgent = useBehaviorSubject(realmAgent$);
  const address = useReduxSelector(state => state.auth?.address);
  const dispatch = useDispatch();
  const tokensAddressAndRealmAgent = useMemo(
    () =>
      realmAgent && realmAgent.realm.netId === networkId && address
        ? {
            tokens: [
              ...(Object.values(
                realmAgent.realm.pools[poolVersion]!,
              ) as SynthereumPool<PoolVersion>[]).map(
                pool => pool.syntheticToken,
              ),
              realmAgent.realm.collateralToken,
            ],
            address,
            realmAgent,
          }
        : null,
    [realmAgent, networkId, address],
  );

  useEffect(() => {
    if (!tokensAddressAndRealmAgent || !checkIsSupportedNetwork(networkId))
      return;

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { address, tokens, realmAgent } = tokensAddressAndRealmAgent;

    let canceled = false;

    const url = transactionsSubgraphUrls[networkIdToName[networkId]];

    run(async () => {
      const db = await dbPromise;
      if (canceled) return;

      const storedTransactions = await db.getAllFromIndex(
        'transactions',
        'networkId, from',
        [networkId, address],
      );
      if (canceled) return;

      if (storedTransactions.length) {
        dispatch(addTransactions(storedTransactions));

        const data = await fetchTransactions(url, address, {
          blockNumber_gt: findLargestBlockNumber(storedTransactions),
        });

        function checkPendingTransactions(transactions: ResponseTransaction[]) {
          // Not yet indexed or failed tranasactions
          storedTransactions
            .filter(tx => tx.block === 0)
            .forEach(tx => {
              const hash = tx.hash;
              const found = transactions.find(({ id }) => id === hash);
              if (found) return;

              const { web3 } = realmAgent.realm;

              web3.eth
                .getTransactionReceipt(hash)
                .then(data => {
                  if (!data) return null;
                  return Promise.all([
                    web3.eth.getBlock(data.blockNumber),
                    data.status,
                  ]);
                })
                .then(value => {
                  if (!value) return;

                  const transaction: SynthereumTransaction = {
                    ...tx,
                    block: value[0].number,
                    timestamp: (value[0].timestamp as number) * 1000,
                    status: (value[1]
                      ? 'success'
                      : 'failure') as TransactionStatus,
                  };
                  dispatch(updateTranasactionStatus(transaction));
                  db.put('transactions', transaction);
                });
            });
        }

        if (canceled) return;
        if (!data.data) return checkPendingTransactions([]);

        const { transactions } = data.data;

        if (transactions.length) {
          await addTransactionsToIndexedDBAndRedux(
            dispatch,
            db,
            tokens,
            networkId,
            address,
            transactions,
          );
        }

        checkPendingTransactions(transactions);

        return;
      }

      const data = await fetchTransactions(url, address);

      if (canceled || !data.data) return;

      await addTransactionsToIndexedDBAndRedux(
        dispatch,
        db,
        tokens,
        networkId,
        address,
        data.data.transactions,
      );
    });

    return () => {
      canceled = true;
    };
  }, [tokensAddressAndRealmAgent, networkId]);

  return useMemo(
    () => ({
      fetchMoreTransactions() {
        if (!tokensAddressAndRealmAgent) return;

        const { address, tokens } = tokensAddressAndRealmAgent;

        dispatch(fetchAndStoreMoreTransactions({ networkId, address, tokens }));
      },
    }),
    [dispatch, networkId, tokensAddressAndRealmAgent],
  );
}

type FecthOptionsNewerTransactions = {
  blockNumber_gt: number;
};
type FetchOptionsOlderTransactions = {
  blockNumber_lte: number;
  id_not_in: TransactionHash[];
};
export function fetchTransactions(
  url: string,
  address: Address,
  options?: FecthOptionsNewerTransactions | FetchOptionsOlderTransactions,
) {
  const { blockNumber_lte, id_not_in, blockNumber_gt } = (options ||
    {}) as Partial<
    FetchOptionsOlderTransactions & FecthOptionsNewerTransactions
  >;

  if (blockNumber_gt && blockNumber_lte)
    throw new Error(
      'Can not have both blockNumber_gt and blockNumber_lte defined',
    );

  if (blockNumber_lte && (!Array.isArray(id_not_in) || !id_not_in.length))
    throw new Error(
      'When blockNumber_lte you need to have at least one transaction has in id_not_in',
    );

  const query = `
{
  transactions(first: 30, orderBy: block, orderDirection: desc, where: {userAddress: "${address}", poolVersion: "${
    poolVersion[1]
  }"${blockNumber_gt ? `, block_gt: "${blockNumber_gt}"` : ''}${
    blockNumber_lte
      ? `, block_lte: "${blockNumber_lte}", id_not_in: [${id_not_in!
          .map(hash => `"${hash}"`)
          .join(',')}]`
      : ''
  }}) {
    id
    type
    timestamp
    block
    inputTokenAmount
    inputTokenAddress
    outputTokenAmount
    outputTokenAddress
  }
}
`;

  return fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  }).then(response => response.json() as TheGraphTransactionsSubgraphResponse);
}

export function mapTheGraphResponseToStateCompatibleShape(
  tokens: TokenInfo<SupportedNetworkName>[],
  networkId: SupportedNetworkId,
  from: Address,
  transactions: ResponseTransaction[],
) {
  return transactions.map(
    ({
      id,
      inputTokenAddress,
      inputTokenAmount,
      outputTokenAddress,
      outputTokenAmount,
      type,
      timestamp,
      block,
    }) => ({
      hash: id,
      type,
      input: getTransactionIO(tokens, inputTokenAddress, inputTokenAmount),
      output: getTransactionIO(tokens, outputTokenAddress, outputTokenAmount),
      timestamp: parseInt(`${timestamp}000`, 10),
      networkId,
      block: parseInt(block, 10),
      from,
      status: 'success' as TransactionStatus,
    }),
  );
}

function addTransactionsToIndexedDBAndRedux(
  dispatch: ReturnType<typeof useDispatch>,
  db: DB,
  tokens: TokenInfo<SupportedNetworkName>[],
  networkId: SupportedNetworkId,
  from: Address,
  transactions: ResponseTransaction[],
) {
  const formattedTransactions = mapTheGraphResponseToStateCompatibleShape(
    tokens,
    networkId,
    from,
    transactions,
  );
  dispatch(
    addTransactions(
      formattedTransactions.length ? formattedTransactions : null,
    ),
  );

  return addTransactionsToIndexedDB(db, formattedTransactions);
}

export function addTransactionsToIndexedDB(
  db: DB,
  transactions: SynthereumTransaction[],
) {
  const dbTx = db.transaction('transactions', 'readwrite');
  const dbAddPromises: Promise<unknown>[] = transactions.map(transaction =>
    dbTx.store.put(transaction),
  );
  dbAddPromises.push(dbTx.done);
  return Promise.all(dbAddPromises);
}

function getTransactionIO(
  tokens: TokenInfo<NetworkName>[],
  address: Address,
  amount: string,
): TransactionIO {
  const token = tokens.find(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    token => token!.address.toLowerCase() === address.toLowerCase(),
  );
  if (!token) {
    throw new Error(`Couldn't find token with address ${address}`);
  }
  return {
    amount: FPN.fromWei(
      token.symbol === primaryCollateralSymbol
        ? `${amount}000000000000` // TODO: Use token.decimals + padEnd
        : amount,
    ).toString(),
    asset: assetsObject[token.symbol].symbol,
  };
}

export function findLargestBlockNumber(transactions: SynthereumTransaction[]) {
  return transactions.reduce(
    (largestBlock, transaction) =>
      transaction.block > largestBlock ? transaction.block : largestBlock,
    0,
  );
}

export function findSmallestBlockNumber(transactions: SynthereumTransaction[]) {
  return transactions.reduce((smallestBlock, transaction) => {
    if (transaction.block === 0) return smallestBlock;
    return transaction.block < smallestBlock
      ? transaction.block
      : smallestBlock;
  }, Infinity);
}

function run<T>(callback: () => T) {
  return callback();
}
