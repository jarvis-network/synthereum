import { assetsObject } from '@/data/assets';
import { TransactionIO } from '@/data/transactions';
import { addTransactions } from '@/state/slices/transactions';
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
import { TransactionHash } from '@jarvis-network/core-utils/dist/eth/transaction';
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

const urls = {
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
  const tokensAndAddress = useMemo(
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
          }
        : null,
    [realmAgent, networkId, address],
  );

  useEffect(() => {
    if (!tokensAndAddress || !checkIsSupportedNetwork(networkId)) return;

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { address, tokens } = tokensAndAddress;

    let canceled = false;

    const url = urls[networkIdToName[networkId]];

    run(async () => {
      const db = await dbPromise;

      const storedTransactions = await db.getAllFromIndex(
        'transactions',
        'networkId, from',
        [networkId, address],
      );

      if (storedTransactions.length) {
        dispatch(addTransactions(storedTransactions));

        const largestBlock = storedTransactions.reduce(
          (largestBlockNumber, transaction) =>
            transaction.block > largestBlockNumber
              ? transaction.block
              : largestBlockNumber,
          0,
        );

        const data = await fetchTransactions(url, address, largestBlock);

        if (canceled || !data.data) return;

        await addTransactionsToIndexedDB(
          dispatch,
          db,
          tokens,
          networkId,
          address,
          data.data.transactions,
        );
        return;
      }

      const data = await fetchTransactions(url, address);

      if (canceled || !data.data) return;

      await addTransactionsToIndexedDB(
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
  }, [tokensAndAddress, networkId]);
}

function fetchTransactions(
  url: string,
  address: string,
  blockNumberGreatherThan?: number,
) {
  const query = `
{
  transactions(where: {userAddress: "${address}", poolVersion: "${
    poolVersion[1]
  }"${
    blockNumberGreatherThan ? `, block_gt: "${blockNumberGreatherThan}"` : ''
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

function addTransactionsToIndexedDB(
  dispatch: ReturnType<typeof useDispatch>,
  db: DB,
  tokens: TokenInfo<SupportedNetworkName>[],
  networkId: SupportedNetworkId,
  from: Address,
  transactions: ResponseTransaction[],
) {
  const formattedTransactions = transactions.map(
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
    }),
  );
  dispatch(addTransactions(formattedTransactions));

  const dbTx = db.transaction('transactions', 'readwrite');
  const dbAddPromises: Promise<unknown>[] = formattedTransactions.map(
    transaction => dbTx.store.add(transaction),
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

function run<T>(callback: () => T) {
  return callback();
}
