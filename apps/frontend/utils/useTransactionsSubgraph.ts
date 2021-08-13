import { assetsObject } from '@/data/assets';
import { SynthereumTransaction, TransactionIO } from '@/data/transactions';
import {
  addTransactions,
  fetchAndStoreMoreTransactions,
  updateTranasactionStatus,
} from '@/state/slices/transactions';
import {
  isSupportedNetwork,
  primaryCollateralSymbol,
  SupportedNetworkId,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-contracts/dist/config';
import {
  PoolVersion,
  SynthereumPool,
} from '@jarvis-network/synthereum-ts/dist/core/types/pools';
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
  useWeb3,
} from '@jarvis-network/app-toolkit';

import {
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
  HttpLink,
  split,
} from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { WebSocketLink } from '@apollo/client/link/ws';
import gql from 'graphql-tag';
import {
  GetTransactions,
  GetTransactionsVariables,
  GetTransactions_transactions as GetTransactionsTransactions,
} from 'generated/GetTransactions';
import { useMemoOne } from 'use-memo-one';
import {
  OnTransactionIndexed,
  OnTransactionIndexedVariables,
} from 'generated/OnTransactionIndexed';
import {
  GetNewTransactions,
  GetNewTransactionsVariables,
  GetNewTransactions_transactions as GetNewTransactionsTransactions,
} from 'generated/GetNewTransactions';
import {
  GetOldTransactions,
  GetOldTransactionsVariables,
} from 'generated/GetOldTransactions';

import { dbPromise, DB } from './db';

export const transactionsSubgraphUrls = {
  mainnet: 's://api.thegraph.com/subgraphs/name/jarvis-network/synthereum',
  kovan: 's://api.thegraph.com/subgraphs/name/jarvis-network/synthereum-kovan',
  polygon:
    's://api.thegraph.com/subgraphs/name/jarvis-network/synthereum-polygon',
  mumbai:
    's://api.thegraph.com/subgraphs/name/jarvis-network/synthereum-mumbai',
};

const QUERY_BASIC = gql`
  query GetTransactions($address: Bytes!) {
    transactions(
      first: 30
      orderBy: block
      orderDirection: desc
      where: { userAddress: $address, poolVersion_in: ["3", "4"] }
    ) {
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

const QUERY_GET_NEW = gql`
  query GetNewTransactions(
    $address: Bytes!
    $blockNumberGreaterThenOrEqualTo: BigInt!
    $idNotIn: [ID!]!
  ) {
    transactions(
      first: 1000
      orderBy: block
      orderDirection: asc
      where: {
        userAddress: $address
        poolVersion_in: ["3", "4"]
        block_gte: $blockNumberGreaterThenOrEqualTo
        id_not_in: $idNotIn
      }
    ) {
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

const QUERY_GET_OLD = gql`
  query GetOldTransactions(
    $address: Bytes!
    $blockNumberLessThanOrEqualTo: BigInt!
    $idNotIn: [ID!]!
  ) {
    transactions(
      first: 30
      orderBy: block
      orderDirection: desc
      where: {
        userAddress: $address
        poolVersion_in: ["3", "4"]
        block_lte: $blockNumberLessThanOrEqualTo
        id_not_in: $idNotIn
      }
    ) {
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

const SUBSCRIPTION = gql`
  subscription OnTransactionIndexed($address: ID!) {
    user(id: $address) {
      lastTransactions(
        first: 1
        orderBy: block
        orderDirection: desc
        where: { poolVersion_in: ["3", "4"] }
      ) {
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
  }
`;

function getLink(url: string) {
  const httpLink = new HttpLink({
    uri: `http${url}`,
  });

  const wsLink = new WebSocketLink({
    uri: `ws${url}`,
    options: {
      reconnect: true,
    },
  });

  // The split function takes three parameters:
  //
  // * A function that's called for each operation to execute
  // * The Link to use for an operation if the function returns a "truthy" value
  // * The Link to use for an operation if the function returns a "falsy" value
  return split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    wsLink,
    httpLink,
  );
}

const poolVersion = process.env.NEXT_PUBLIC_POOL_VERSION as PoolVersion;

export function useTransactionsSubgraph(): { fetchMoreTransactions(): void } {
  const realmAgent = useBehaviorSubject(useCoreObservables().realmAgent$);
  const { account: address, chainId: networkId } = useWeb3();
  const dispatch = useDispatch();
  const apolloClientAndNetworkId = useMemoOne(
    () =>
      networkId && isSupportedNetwork(networkId)
        ? {
            networkId: networkId as SupportedNetworkId,
            apolloClient: new ApolloClient({
              link: getLink(
                transactionsSubgraphUrls[networkIdToName[networkId]],
              ),
              cache: new InMemoryCache(),
              defaultOptions: {
                query: {
                  fetchPolicy: 'no-cache',
                },
                watchQuery: {
                  fetchPolicy: 'no-cache',
                },
              },
            }),
          }
        : null,
    [networkId],
  );
  const deps = useMemoOne(
    () =>
      apolloClientAndNetworkId &&
      realmAgent &&
      realmAgent.realm.netId === apolloClientAndNetworkId.networkId &&
      address
        ? {
            ...apolloClientAndNetworkId,
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
    [realmAgent, apolloClientAndNetworkId, address],
  );

  useEffect(() => {
    if (!deps) return;

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { address, tokens, realmAgent, networkId, apolloClient } = deps;

    let canceled = false;

    run(async () => {
      const db = await dbPromise;
      if (canceled) return;

      const storedTransactions = await db.getAllFromIndex(
        'transactions',
        'networkId, from',
        [networkId, address as any],
      );
      if (canceled) return;

      if (storedTransactions.length) {
        dispatch(addTransactions(storedTransactions));

        const transactions = await fetchNewTransactions(
          apolloClient,
          address as any,
          storedTransactions,
        );

        if (canceled) return;

        if (transactions.length) {
          await addTransactionsToIndexedDBAndRedux(
            dispatch,
            db,
            tokens,
            networkId,
            address as any,
            transactions,
          );
        }

        // Not yet indexed or failed tranasactions
        storedTransactions
          .filter(tx => tx.block === 0)
          .forEach(tx => {
            const { hash } = tx;
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

        return;
      }

      const { data, error } = await fetchTransactions(
        apolloClient,
        address as any,
      );

      if (error) throw error;
      if (canceled) return;

      await addTransactionsToIndexedDBAndRedux(
        dispatch,
        db,
        tokens,
        networkId,
        address as any,
        data.transactions,
      );
    });

    const subscription = apolloClient
      .subscribe<OnTransactionIndexed, OnTransactionIndexedVariables>({
        query: SUBSCRIPTION,
        variables: {
          address,
        },
      })
      .subscribe(({ errors, data }) => {
        if (errors) return errors.forEach(error => console.error(error));

        if (data && data.user) {
          dbPromise.then(db => {
            addTransactionsToIndexedDBAndRedux(
              dispatch,
              db,
              tokens,
              networkId,
              address as any,
              data.user!.lastTransactions,
            );
          });
        }
      });

    return () => {
      canceled = true;
      subscription.unsubscribe();
    };
  }, [deps, dispatch]);

  return useMemo(
    () => ({
      fetchMoreTransactions() {
        if (!deps)
          throw new Error('Calling fetch more before dependencies have loaded');

        // eslint-disable-next-line @typescript-eslint/no-shadow
        const { address, tokens, apolloClient, networkId } = deps;

        dispatch(
          fetchAndStoreMoreTransactions({
            apolloClient,
            networkId,
            address: address as any,
            tokens,
          }),
        );
      },
    }),
    [dispatch, deps],
  );
}

type FecthOptionsNewerTransactions = {
  blockNumberGreaterThenOrEqualTo: number;
  idNotIn: TransactionHash[];
};
type FetchOptionsOlderTransactions = {
  blockNumberLessThanOrEqualTo: number;
  idNotIn: TransactionHash[];
};
export function fetchTransactions(
  client: ApolloClient<NormalizedCacheObject>,
  address: Address,
  options?: FecthOptionsNewerTransactions | FetchOptionsOlderTransactions,
) {
  const {
    blockNumberLessThanOrEqualTo,
    blockNumberGreaterThenOrEqualTo,
    idNotIn,
  } = (options || {}) as Partial<
    FetchOptionsOlderTransactions & FecthOptionsNewerTransactions
  >;

  if (blockNumberGreaterThenOrEqualTo && blockNumberLessThanOrEqualTo)
    throw new Error(
      'Can not have both blockNumberGreaterThenOrEqualTo and blockNumberLessThanOrEqualTo defined',
    );

  if (
    blockNumberLessThanOrEqualTo &&
    (!Array.isArray(idNotIn) || !idNotIn.length)
  )
    throw new Error(
      'When blockNumberLessThanOrEqualTo you need to have at least one transaction hash in idNotIn',
    );

  if (
    blockNumberGreaterThenOrEqualTo &&
    (!Array.isArray(idNotIn) || !idNotIn.length)
  )
    throw new Error(
      'When blockNumberGreaterThenOrEqualTo you need to have at least one transaction hash in idNotIn',
    );

  if (blockNumberGreaterThenOrEqualTo) {
    return client.query<GetNewTransactions, GetNewTransactionsVariables>({
      query: QUERY_GET_NEW,
      variables: {
        address,
        blockNumberGreaterThenOrEqualTo: blockNumberGreaterThenOrEqualTo.toString(),
        idNotIn: idNotIn!,
      },
    });
  }

  if (blockNumberLessThanOrEqualTo) {
    return client.query<GetOldTransactions, GetOldTransactionsVariables>({
      query: QUERY_GET_OLD,
      variables: {
        address,
        blockNumberLessThanOrEqualTo: blockNumberLessThanOrEqualTo.toString(),
        idNotIn: idNotIn!,
      },
    });
  }

  return client.query<GetTransactions, GetTransactionsVariables>({
    query: QUERY_BASIC,
    variables: {
      address,
    },
  });
}

async function fetchNewTransactions(
  apolloClient: ApolloClient<NormalizedCacheObject>,
  address: Address,
  storedTransactions: SynthereumTransaction[],
  newTransactions?: GetNewTransactionsTransactions[],
): Promise<GetNewTransactionsTransactions[]> {
  const combinedTransactions: {
    hash: TransactionHash;
    block: number;
  }[] = newTransactions
    ? (storedTransactions as { hash: TransactionHash; block: number }[]).concat(
        newTransactions.map(tx => ({
          hash: tx.id as TransactionHash,
          block: parseInt(tx.block, 10),
        })),
      )
    : storedTransactions;

  const largestBlockNumber = findLargestBlockNumber(combinedTransactions);
  const { data, error } = await fetchTransactions(apolloClient, address, {
    blockNumberGreaterThenOrEqualTo: largestBlockNumber,
    idNotIn: combinedTransactions
      .filter(tx => tx.block === largestBlockNumber)
      .map(tx => tx.hash),
  });

  if (error) throw error;

  const allNewTransactions = newTransactions
    ? data.transactions.concat(newTransactions)
    : data.transactions;

  if (data.transactions.length === 1000) {
    return fetchNewTransactions(
      apolloClient,
      address,
      storedTransactions,
      allNewTransactions,
    );
  }

  return allNewTransactions;
}
export function mapTheGraphResponseToStateCompatibleShape(
  tokens: TokenInfo<SupportedNetworkName>[],
  networkId: SupportedNetworkId,
  from: Address,
  transactions: GetTransactionsTransactions[],
): SynthereumTransaction[] {
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
      hash: id as TransactionHash,
      type,
      input: getTransactionIO(
        tokens,
        inputTokenAddress as Address,
        inputTokenAmount,
      ),
      output: getTransactionIO(
        tokens,
        outputTokenAddress as Address,
        outputTokenAmount,
      ),
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
  transactions: GetTransactionsTransactions[],
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

export function findLargestBlockNumber(transactions: { block: number }[]) {
  return transactions.reduce(
    (largestBlock, transaction) =>
      transaction.block > largestBlock ? transaction.block : largestBlock,
    0,
  );
}

export function findSmallestBlockNumber(transactions: SynthereumTransaction[]) {
  return transactions.reduce(
    (smallestBlock, transaction) =>
      transaction.block === 0
        ? smallestBlock
        : transaction.block < smallestBlock
        ? transaction.block
        : smallestBlock,
    Infinity,
  );
}

function run<T>(callback: () => T) {
  return callback();
}
