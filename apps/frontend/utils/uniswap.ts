import { useReduxSelector } from '@/state/useReduxSelector';
import { useEffect, useMemo, useRef } from 'react';
import {
  Pair,
  Trade,
  FACTORY_ADDRESS as uniswapFactoryAddress,
  computePairAddress,
} from '@uniswap/v2-sdk';
import {
  Currency,
  CurrencyAmount,
  TradeType,
  Token,
  Percent,
  WETH9,
} from '@uniswap/sdk-core';
import {
  useMulticallMultipleAddresses,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { flatMap } from 'lodash';
import JSBI from 'jsbi';
import { AbiItem } from 'ethereum-multicall/dist/esm/models';
import { hexToNumberString } from 'web3-utils';
import { useDispatch } from 'react-redux';
import { addToAddressIsContractCache } from '@/state/slices/cache';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';
import { addresses } from '@/data/addresses';

const quickswapFactoryAddress = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32';

const PAIR_ABI = [
  {
    inputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount0',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount1',
        type: 'uint256',
      },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
    ],
    name: 'Burn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount0',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount1',
        type: 'uint256',
      },
    ],
    name: 'Mint',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount0In',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount1In',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount0Out',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount1Out',
        type: 'uint256',
      },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
    ],
    name: 'Swap',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint112',
        name: 'reserve0',
        type: 'uint112',
      },
      {
        indexed: false,
        internalType: 'uint112',
        name: 'reserve1',
        type: 'uint112',
      },
    ],
    name: 'Sync',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    constant: true,
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'MINIMUM_LIQUIDITY',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'PERMIT_TYPEHASH',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { internalType: 'address', name: '', type: 'address' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ internalType: 'address', name: 'to', type: 'address' }],
    name: 'burn',
    outputs: [
      { internalType: 'uint256', name: 'amount0', type: 'uint256' },
      { internalType: 'uint256', name: 'amount1', type: 'uint256' },
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'factory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'getReserves',
    outputs: [
      { internalType: 'uint112', name: '_reserve0', type: 'uint112' },
      { internalType: 'uint112', name: '_reserve1', type: 'uint112' },
      { internalType: 'uint32', name: '_blockTimestampLast', type: 'uint32' },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { internalType: 'address', name: '_token0', type: 'address' },
      { internalType: 'address', name: '_token1', type: 'address' },
    ],
    name: 'initialize',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'kLast',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ internalType: 'address', name: 'to', type: 'address' }],
    name: 'mint',
    outputs: [{ internalType: 'uint256', name: 'liquidity', type: 'uint256' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'nonces',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'uint8', name: 'v', type: 'uint8' },
      { internalType: 'bytes32', name: 'r', type: 'bytes32' },
      { internalType: 'bytes32', name: 's', type: 'bytes32' },
    ],
    name: 'permit',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'price0CumulativeLast',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'price1CumulativeLast',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ internalType: 'address', name: 'to', type: 'address' }],
    name: 'skim',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { internalType: 'uint256', name: 'amount0Out', type: 'uint256' },
      { internalType: 'uint256', name: 'amount1Out', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'swap',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [],
    name: 'sync',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as AbiItem[];

enum PairState {
  LOADING,
  NOT_EXISTS,
  EXISTS,
  INVALID,
}

export function useV2Pairs(
  currencies: [Currency | undefined, Currency | undefined][],
): [PairState, Pair | null][] {
  const { library: web3, chainId: networkId } = useWeb3();

  const tokens = useMemo(
    () =>
      currencies.map(([currencyA, currencyB]) => [
        currencyA?.wrapped,
        currencyB?.wrapped,
      ]),
    [currencies],
  );

  const pairAddresses = useMemo(
    () =>
      tokens.map(
        ([tokenA, tokenB]) =>
          tokenA &&
          tokenB &&
          tokenA.chainId === tokenB.chainId &&
          !tokenA.equals(tokenB) &&
          computePairAddress({
            factoryAddress:
              networkId === Network.polygon || networkId === Network.mumbai
                ? quickswapFactoryAddress
                : uniswapFactoryAddress,
            tokenA,
            tokenB,
          }),
      ),
    [tokens],
  );

  const addressIsContractCache = useReduxSelector(
    state => state.cache.addressIsContract,
  );
  const dispatch = useDispatch();
  const calls = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!web3 || !networkId) return;

    for (const address of pairAddresses) {
      if (
        !address ||
        Object.prototype.hasOwnProperty.call(addressIsContractCache, address) ||
        calls.current[address] === networkId
      )
        return;

      calls.current[address] = networkId;

      // eslint-disable-next-line no-loop-func
      web3.eth.getCode(address).then(result => {
        if (calls.current[address] !== networkId) return;

        dispatch(
          addToAddressIsContractCache({
            /**
             * If `result` is `0x` it will coerce to `NaN`. If it's `0x0` it will coerce to `0`.
             * `Boolean(NaN)` is `false`. `Boolean(0)` is also `false`.
             */
            [address]: Boolean(Number(result)),
          }),
        );
      });
    }
  }, [pairAddresses, addressIsContractCache, dispatch, web3, networkId]);

  const checkedPairAddresses = useMemo(
    () =>
      pairAddresses.map(
        address => addressIsContractCache[address as string] && address,
      ),
    [pairAddresses, addressIsContractCache],
  );

  const results = useMulticallMultipleAddresses(
    checkedPairAddresses,
    PAIR_ABI,
    'getReserves',
  );

  return useMemo(
    () =>
      results.map((result, i) => {
        if (addressIsContractCache[pairAddresses[i] as string] === false)
          return [PairState.NOT_EXISTS, null];
        if (!result) return [PairState.LOADING, null];
        // const { result: reserves, loading } = result;
        const tokenA = tokens[i][0];
        const tokenB = tokens[i][1];

        // if (loading) return [PairState.LOADING, null];
        if (!tokenA || !tokenB || tokenA.equals(tokenB))
          return [PairState.INVALID, null];
        const [reserve0, reserve1] = result;
        const [token0, token1] = tokenA.sortsBefore(tokenB)
          ? [tokenA, tokenB]
          : [tokenB, tokenA];
        return [
          PairState.EXISTS,
          new Pair(
            CurrencyAmount.fromRawAmount(
              token0,
              hexToNumberString(reserve0.hex),
            ),
            CurrencyAmount.fromRawAmount(
              token1,
              hexToNumberString(reserve1.hex),
            ),
          ),
        ];
      }),
    [addressIsContractCache, pairAddresses, results, tokens],
  );
}

export function useV2Pair(
  tokenA?: Currency,
  tokenB?: Currency,
): [PairState, Pair | null] {
  const inputs: [[Currency | undefined, Currency | undefined]] = useMemo(
    () => [[tokenA, tokenB]],
    [tokenA, tokenB],
  );
  return useV2Pairs(inputs)[0];
}

// used to ensure the user doesn't send so much ETH so they end up with <.01
export const BETTER_TRADE_LESS_HOPS_THRESHOLD = new Percent(
  JSBI.BigInt(50),
  JSBI.BigInt(10000),
);

export function useAllCommonPairs(
  currencyA?: Currency,
  currencyB?: Currency,
): { commonPairs: Pair[]; isLoading: boolean } {
  const allCurrencyCombinations = useAllCurrencyCombinations(
    currencyA,
    currencyB,
  );

  const allPairs = useV2Pairs(allCurrencyCombinations);

  // only pass along valid pairs, non-duplicated pairs
  return useMemo(
    () => ({
      commonPairs: Object.values(
        allPairs
          // filter out invalid pairs
          .filter((result): result is [PairState.EXISTS, Pair] =>
            Boolean(result[0] === PairState.EXISTS && result[1]),
          )
          // filter out duplicated pairs
          .reduce<{ [pairAddress: string]: Pair }>((memo, [, curr]) => {
            memo[curr.liquidityToken.address] =
              memo[curr.liquidityToken.address] ?? curr;
            return memo;
          }, {}),
      ),
      isLoading: Boolean(
        allPairs.filter(([state]) => state === PairState.LOADING).length,
      ),
    }),
    [allPairs],
  );
}

export const MAX_HOPS = 3;

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 */
export function useV2TradeExactIn(
  currencyAmountIn?: CurrencyAmount<Currency>,
  currencyOut?: Currency,
  { maxHops = MAX_HOPS } = {},
): {
  trade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | null;
  isLoading: boolean;
} {
  const { commonPairs, isLoading } = useAllCommonPairs(
    currencyAmountIn?.currency,
    currencyOut,
  );

  return useMemo(() => {
    if (currencyAmountIn && currencyOut && commonPairs.length > 0) {
      if (maxHops === 1) {
        return {
          isLoading,
          trade:
            Trade.bestTradeExactIn(commonPairs, currencyAmountIn, currencyOut, {
              maxHops: 1,
              maxNumResults: 1,
            })[0] ?? null,
        };
      }
      // search through trades with varying hops, find best trade out of them
      let bestTradeSoFar: Trade<
        Currency,
        Currency,
        TradeType.EXACT_INPUT
      > | null = null;
      for (let i = 1; i <= maxHops; i++) {
        const currentTrade: Trade<
          Currency,
          Currency,
          TradeType.EXACT_INPUT
        > | null =
          Trade.bestTradeExactIn(commonPairs, currencyAmountIn, currencyOut, {
            maxHops: i,
            maxNumResults: 1,
          })[0] ?? null;
        // if current trade is best yet, save it
        if (
          isTradeBetter(
            bestTradeSoFar,
            currentTrade,
            BETTER_TRADE_LESS_HOPS_THRESHOLD,
          )
        ) {
          bestTradeSoFar = currentTrade;
        }
      }
      return { trade: bestTradeSoFar, isLoading };
    }

    return { trade: null, isLoading };
  }, [commonPairs, isLoading, currencyAmountIn, currencyOut, maxHops]);
}

/**
 * Returns the best trade for the token in to the exact amount of token out
 */
export function useV2TradeExactOut(
  currencyIn?: Currency,
  currencyAmountOut?: CurrencyAmount<Currency>,
  { maxHops = MAX_HOPS } = {},
): {
  trade: Trade<Currency, Currency, TradeType.EXACT_OUTPUT> | null;
  isLoading: boolean;
} {
  const { commonPairs, isLoading } = useAllCommonPairs(
    currencyIn,
    currencyAmountOut?.currency,
  );

  return useMemo(() => {
    if (currencyIn && currencyAmountOut && commonPairs.length > 0) {
      if (maxHops === 1) {
        return {
          isLoading,
          trade:
            Trade.bestTradeExactOut(
              commonPairs,
              currencyIn,
              currencyAmountOut,
              {
                maxHops: 1,
                maxNumResults: 1,
              },
            )[0] ?? null,
        };
      }
      // search through trades with varying hops, find best trade out of them
      let bestTradeSoFar: Trade<
        Currency,
        Currency,
        TradeType.EXACT_OUTPUT
      > | null = null;
      for (let i = 1; i <= maxHops; i++) {
        const currentTrade =
          Trade.bestTradeExactOut(commonPairs, currencyIn, currencyAmountOut, {
            maxHops: i,
            maxNumResults: 1,
          })[0] ?? null;
        if (
          isTradeBetter(
            bestTradeSoFar,
            currentTrade,
            BETTER_TRADE_LESS_HOPS_THRESHOLD,
          )
        ) {
          bestTradeSoFar = currentTrade;
        }
      }
      return { trade: bestTradeSoFar, isLoading };
    }
    return { trade: null, isLoading };
  }, [currencyIn, currencyAmountOut, commonPairs, maxHops, isLoading]);
}

type ChainTokenList = {
  readonly [chainId: number]: Token[];
};

// used to construct intermediary pairs for trading
const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
  '1': [
    new Token(1, addresses[1].WBTC, 8, 'WBTC', 'Wrapped Bitcoin'),
    WETH9[1],
    new Token(1, addresses[1].MATIC, 18, 'MATIC', 'Matic'),
    new Token(1, addresses[1].JRT, 18, 'JRT', 'Jarvis Reward Token'),
    new Token(1, addresses[1].AAVE, 18, 'AAVE', 'Aave Token'),
    new Token(1, addresses[1].UMA, 18, 'UMA', 'UMA Token'),
    new Token(1, addresses[1].LINK, 18, 'LINK', 'ChainLink Token'),
    new Token(1, addresses[1].QUICK, 18, 'QUICK', 'Quickswap'),
    new Token(1, addresses[1].SUSHI, 18, 'SUSHI', 'SushiToken'),
  ],
  '42': [
    new Token(42, addresses[42].WBTC, 8, 'WBTC', 'Wrapped Bitcoin'),
    WETH9[42],
    new Token(42, addresses[42].MATIC, 18, 'MATIC', 'Matic'),
    new Token(42, addresses[42].JRT, 18, 'JRT', 'Jarvis Reward Token'),
    new Token(42, addresses[42].AAVE, 18, 'AAVE', 'Aave Token'),
    new Token(42, addresses[42].UMA, 18, 'UMA', 'UMA Token'),
    new Token(42, addresses[42].LINK, 18, 'LINK', 'ChainLink Token'),
    new Token(42, addresses[42].QUICK, 18, 'QUICK', 'Quickswap'),
    new Token(42, addresses[42].SUSHI, 18, 'SUSHI', 'SushiToken'),
  ],
  '137': [
    new Token(137, addresses[137].WBTC, 8, 'WBTC', 'Wrapped Bitcoin'),
    new Token(137, addresses[137].ETH, 18, 'ETH', 'Ether'),
    new Token(137, addresses[137].WMATIC, 18, 'WMATIC', 'Wrapped Matic'),
    new Token(137, addresses[137].JRT, 18, 'JRT', 'Jarvis Reward Token'),
    new Token(137, addresses[137].AAVE, 18, 'AAVE', 'Aave Token'),
    new Token(137, addresses[137].UMA, 18, 'UMA', 'UMA Token'),
    new Token(137, addresses[137].LINK, 18, 'LINK', 'ChainLink Token'),
    new Token(137, addresses[137].QUICK, 18, 'QUICK', 'Quickswap'),
    new Token(137, addresses[137].SUSHI, 18, 'SUSHI', 'SushiToken'),
  ],
};
const ADDITIONAL_BASES: {
  [chainId: number]: { [tokenAddress: string]: Token[] };
} = {};

const CUSTOM_BASES: {
  [chainId: number]: { [tokenAddress: string]: Token[] };
} = {};

export function useAllCurrencyCombinations(
  currencyA?: Currency,
  currencyB?: Currency,
): [Token, Token][] {
  const { chainId: networkId } = useWeb3();

  const [tokenA, tokenB] = networkId
    ? [currencyA?.wrapped, currencyB?.wrapped]
    : [undefined, undefined];

  const bases: Token[] = useMemo(() => {
    if (!networkId) return [];

    const common = BASES_TO_CHECK_TRADES_AGAINST[networkId] ?? [];
    const additionalA = tokenA
      ? ADDITIONAL_BASES[networkId]?.[tokenA.address] ?? []
      : [];
    const additionalB = tokenB
      ? ADDITIONAL_BASES[networkId]?.[tokenB.address] ?? []
      : [];

    return [...common, ...additionalA, ...additionalB];
  }, [networkId, tokenA, tokenB]);

  const basePairs: [Token, Token][] = useMemo(
    () =>
      flatMap(bases, (base): [Token, Token][] =>
        bases.map(otherBase => [base, otherBase]),
      ),
    [bases],
  );

  return useMemo(
    () =>
      tokenA && tokenB
        ? [
            // the direct pair
            [tokenA, tokenB],
            // token A against all bases
            ...bases.map((base): [Token, Token] => [tokenA, base]),
            // token B against all bases
            ...bases.map((base): [Token, Token] => [tokenB, base]),
            // each base against all bases
            ...basePairs,
          ]
            .filter((tokens): tokens is [Token, Token] =>
              Boolean(tokens[0] && tokens[1]),
            )
            .filter(([t0, t1]) => t0.address !== t1.address)
            .filter(([t0, t1]) => {
              if (!networkId) return true;
              const customBases = CUSTOM_BASES[networkId];

              const customBasesA: Token[] | undefined =
                customBases?.[t0.address];
              const customBasesB: Token[] | undefined =
                customBases?.[t1.address];

              if (!customBasesA && !customBasesB) return true;

              if (customBasesA && !customBasesA.find(base => t1.equals(base)))
                return false;
              if (customBasesB && !customBasesB.find(base => t0.equals(base)))
                return false;

              return true;
            })
        : [],
    [tokenA, tokenB, bases, basePairs, networkId],
  );
}

const ZERO_PERCENT = new Percent('0');
const ONE_HUNDRED_PERCENT = new Percent('1');

// returns whether tradeB is better than tradeA by at least a threshold percentage amount
export function isTradeBetter(
  tradeA: Trade<Currency, Currency, TradeType> | undefined | null,
  tradeB: Trade<Currency, Currency, TradeType> | undefined | null,
  minimumDelta: Percent = ZERO_PERCENT,
): boolean | undefined {
  if (tradeA && !tradeB) return false;
  if (tradeB && !tradeA) return true;
  if (!tradeA || !tradeB) return undefined;

  if (
    tradeA.tradeType !== tradeB.tradeType ||
    !tradeA.inputAmount.currency.equals(tradeB.inputAmount.currency) ||
    !tradeB.outputAmount.currency.equals(tradeB.outputAmount.currency)
  ) {
    throw new Error('Comparing incomparable trades');
  }

  if (minimumDelta.equalTo(ZERO_PERCENT)) {
    return tradeA.executionPrice.lessThan(tradeB.executionPrice);
  }

  return tradeA.executionPrice.asFraction
    .multiply(minimumDelta.add(ONE_HUNDRED_PERCENT))
    .lessThan(tradeB.executionPrice);
}
