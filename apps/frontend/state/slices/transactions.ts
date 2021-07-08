import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { logoutAction, addressSwitch, networkSwitch } from '@/state/actions';
import { initialAppState, State } from '@/state/initialState';
import { SynthereumTransaction } from '@/data/transactions';
import {
  fetchTransactions,
  mapTheGraphResponseToStateCompatibleShape,
  transactionsSubgraphUrls,
  findSmallestBlockNumber,
  addTransactionsToIndexedDB,
} from '@/utils/useTransactionsSubgraph';
import {
  checkIsSupportedNetwork,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-ts/dist/src/config';
import { networkIdToName } from '@jarvis-network/core-utils/dist/eth/networks';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import { TokenInfo } from '@jarvis-network/core-utils/dist/eth/contracts/types';
import { dbPromise } from '@/utils/db';

interface Action<T> {
  payload: T;
}

export const fetchAndStoreMoreTransactions = createAsyncThunk<
  SynthereumTransaction[],
  {
    networkId: number;
    address: Address;
    tokens: TokenInfo<SupportedNetworkName>[];
  },
  { state: State }
>(
  'transactions/fetchMore',
  async ({ networkId, address, tokens }, { getState }) => {
    if (!checkIsSupportedNetwork(networkId)) return [];
    const url = transactionsSubgraphUrls[networkIdToName[networkId]];
    const state = getState();
    const stateTransactionsArray = Object.values(state.transactions);
    const smallestBlockNumber = findSmallestBlockNumber(stateTransactionsArray);
    const response = await fetchTransactions(url, address, {
      blockNumber_lte: smallestBlockNumber,
      id_not_in: stateTransactionsArray
        .filter(tx => tx.block === smallestBlockNumber)
        .map(tx => tx.hash),
    });
    if (!response.data) return [];

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
    { payload: transactions }: Action<SynthereumTransaction[]>,
  ) {
    for (const transcation of transactions) {
      state[transcation.hash] = transcation;
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
        state[tx.hash] = tx;
      },
      addTransactions,
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
export const { addTransactions } = transactionsSlice.actions;
