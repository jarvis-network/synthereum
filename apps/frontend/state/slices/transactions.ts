import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { ApolloClient, NormalizedCacheObject } from '@apollo/client';

import { logoutAction, addressSwitch, networkSwitch } from '@/state/actions';
import { initialAppState, State } from '@/state/initialState';
import { SynthereumTransaction } from '@/data/transactions';
import {
  fetchTransactions,
  mapTheGraphResponseToStateCompatibleShape,
  findSmallestBlockNumber,
  addTransactionsToIndexedDB,
} from '@/utils/useTransactionsSubgraph';
import {
  checkIsSupportedNetwork,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-ts/dist/src/config';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import { TokenInfo } from '@jarvis-network/core-utils/dist/eth/contracts/types';
import {
  TransactionHash,
  TransactionStatus,
} from '@jarvis-network/core-utils/dist/eth/transaction';
import { dbPromise } from '@/utils/db';

interface Action<T> {
  payload: T;
}

export const fetchAndStoreMoreTransactions = createAsyncThunk<
  SynthereumTransaction[] | null,
  {
    apolloClient: ApolloClient<NormalizedCacheObject>;
    networkId: number;
    address: Address;
    tokens: TokenInfo<SupportedNetworkName>[];
  },
  { state: State }
>(
  'transactions/fetchMore',
  async ({ networkId, address, tokens, apolloClient }, { getState }) => {
    if (!checkIsSupportedNetwork(networkId)) return [];
    const state = getState();
    const stateTransactionsArray = Object.values(state.transactions.hashMap);
    const smallestBlockNumber = findSmallestBlockNumber(stateTransactionsArray);
    const response = await fetchTransactions(apolloClient, address, {
      blockNumberLessThanOrEqualTo: smallestBlockNumber,
      idNotIn: stateTransactionsArray
        .filter(tx => tx.block === smallestBlockNumber)
        .map(tx => tx.hash),
    });
    if (!response.data) return [];

    if (!response.data.transactions.length) return null;

    const formattedTransactions = mapTheGraphResponseToStateCompatibleShape(
      tokens,
      networkId,
      address,
      response.data.transactions,
    );

    dbPromise.then(db => {
      addTransactionsToIndexedDB(db, formattedTransactions);
    });

    return formattedTransactions;
  },
);

const initialState = initialAppState.transactions;

function resetState() {
  return initialState;
}

function sliceFactory() {
  function addTransactions(
    state: typeof initialState,
    { payload: transactions }: Action<SynthereumTransaction[] | null>,
  ) {
    if (transactions === null) {
      state.hasOlderTransactions = false;
      return;
    }

    for (const transcation of transactions) {
      state.hashMap[transcation.hash] = transcation;
    }
  }

  return createSlice({
    name: 'transactions',
    initialState,
    reducers: {
      addTransaction: (
        state,
        { payload: tx }: Action<SynthereumTransaction>,
      ) => {
        state.hashMap[tx.hash] = tx;
      },
      addTransactions,
      updateTranasactionStatus(
        state,
        {
          payload: { hash, block, status, timestamp },
        }: Action<{
          hash: TransactionHash;
          block: number;
          status: TransactionStatus;
          timestamp?: number;
        }>,
      ) {
        const tx = state.hashMap[hash];
        tx.status = status;
        tx.block = block;
        if (timestamp) {
          tx.timestamp = timestamp;
        }
        state.hashMap[hash] = tx;
      },
    },
    extraReducers: {
      [addressSwitch.type]: resetState,
      [logoutAction.type]: resetState,
      [networkSwitch.type]: resetState,
      [fetchAndStoreMoreTransactions.fulfilled.type]: addTransactions,
    },
  });
}
const transactionsSlice = sliceFactory();

export const { reducer } = transactionsSlice;
export const {
  addTransactions,
  addTransaction,
  updateTranasactionStatus,
} = transactionsSlice.actions;
