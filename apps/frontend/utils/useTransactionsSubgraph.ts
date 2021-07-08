import { assetsObject } from '@/data/assets';
import { TransactionIO } from '@/data/transactions';
import { addTransactions } from '@/state/slices/transactions';
import { useReduxSelector } from '@/state/useReduxSelector';
import {
  checkIsSupportedNetwork,
  primaryCollateralSymbol,
} from '@jarvis-network/synthereum-ts/dist/src/config';
import {
  PoolVersion,
  SynthereumPool,
} from '@jarvis-network/synthereum-ts/dist/src/core/types/pools';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
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

const urls = {
  mainnet:
    'https://api.thegraph.com/subgraphs/name/aurelienzintzmeyer/synthereum-transactions',
  kovan:
    'https://api.thegraph.com/subgraphs/name/aurelienzintzmeyer/synthereum-transactions-kovan',
};

type ResponseTransaction = {
  id: string;
  inputTokenAddress: Address;
  inputTokenAmount: string;
  outputTokenAddress: Address;
  outputTokenAmount: string;
  timestamp: string; // Seconds
  type: 'Mint' | 'Redeem' | 'Exchange';
};

type Response = {
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
  const tokens = useMemo(
    () =>
      realmAgent
        ? [
            ...(Object.values(
              realmAgent.realm.pools[poolVersion]!,
            ) as SynthereumPool<PoolVersion>[]).map(
              pool => pool.syntheticToken,
            ),
            realmAgent.realm.collateralToken,
          ]
        : null,
    [realmAgent],
  );

  useEffect(() => {
    if (!address || !checkIsSupportedNetwork(networkId) || !tokens) return;

    let canceled = false;

    const url = urls[networkIdToName[networkId]];

    fetch(url, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: buildQuery(address) }),
    })
      .then(response => response.json())
      .then((data: Response) => {
        if (canceled || !data.data) return;
        dispatch(
          addTransactions(
            data.data.transactions.map(
              ({
                id,
                inputTokenAddress,
                inputTokenAmount,
                outputTokenAddress,
                outputTokenAmount,
                type,
                timestamp,
              }) => ({
                hash: id,
                type: type.toLowerCase() as 'mint' | 'exchange' | 'redeem',
                input: getTransactionIO(
                  tokens,
                  inputTokenAddress,
                  inputTokenAmount,
                ),
                output: getTransactionIO(
                  tokens,
                  outputTokenAddress,
                  outputTokenAmount,
                ),
                timestamp: parseInt(`${timestamp}000`, 10),
                networkId,
              }),
            ),
          ),
        );
      });

    return () => {
      canceled = true;
    };
  }, [address, networkId, tokens]);
}

function buildQuery(address: string) {
  return `
{
  transactions(where: {userAddress: "${address}", poolVersion: "${poolVersion[1]}"}) {
    id
    type
    timestamp
    inputTokenAmount
    inputTokenAddress
    outputTokenAmount
    outputTokenAddress
  }
}
`;
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
    ),
    asset: assetsObject[token.symbol],
  };
}
