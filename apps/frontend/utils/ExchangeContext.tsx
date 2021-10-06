import { useReduxSelector } from '@/state/useReduxSelector';
import { calcExchange } from '@/utils/calcExchange';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CurrencyAmount, Token, Percent } from '@uniswap/sdk-core';
import {
  useBehaviorSubject,
  useCoreObservables,
  useMulticallContext,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import {
  isSupportedNetwork,
  synthereumConfig,
} from '@jarvis-network/synthereum-contracts/dist/config';
import {
  ERC20_Abi as ERC20Abi,
  PerpetualPoolParty_Abi as PerpetualPoolPartyAbi,
} from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import { addresses } from '@/data/addresses';
import { debounce, isEqual, memoize } from 'lodash';
import { useStore } from 'react-redux';

import { useV2TradeExactIn, useV2TradeExactOut, MAX_HOPS } from './uniswap';
import { useAssets } from './useAssets';

const ZERO = new FPN(0);
const ONE = new FPN(1);

const context = createContext<ReturnType<typeof useExchangeValues> | null>(
  null,
);

export function useExchangeContext(): ReturnType<typeof useExchangeValues> {
  const value = useContext(context);
  if (!value) throw new Error('ExchangeContext not provided');
  return value;
}

export function ExchangeContextProvider({
  children,
}: {
  children: ReactNode | undefined;
}): JSX.Element {
  return (
    <context.Provider value={useExchangeValues()}>{children}</context.Provider>
  );
}
const empty = {} as {
  payValue: undefined;
  receiveValue: undefined;
  fee: undefined;
  transactionCollateral: undefined;
  minimumReceiveValue: undefined;
  maximumSentValue: undefined;
  minimumSynthReceiveValue: undefined;
  maximumSynthSentValue: undefined;
};
const emptyArray: any[] = [];
function useExchangeValues() {
  const realmAgent = useBehaviorSubject(useCoreObservables().realmAgent$);
  const { chainId: networkId } = useWeb3();
  const store = useStore();
  const assets = useAssets();
  const {
    base,
    pay,
    receive,
    slippage,
    disableMultihops,
    payAsset,
    receiveAsset,
  } = useReduxSelector(state => state.exchange);
  const prices = useReduxSelector(state => state.prices);
  const {
    assetPay,
    assetReceive,
    assetPayPrice,
    assetReceivePrice,
    collateralAsset,
  } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const assetPay = assets.find(a => a.symbol === payAsset);
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const assetReceive = assets.find(a => a.symbol === receiveAsset);
    return {
      assetPay,
      assetReceive,
      assetPayPrice:
        assetPay &&
        (assetPay.collateral
          ? FPN.ONE
          : assetPay.pair && prices[assetPay.pair as string]),
      assetReceivePrice:
        assetReceive &&
        (assetReceive.collateral
          ? FPN.ONE
          : assetReceive.pair && prices[assetReceive.pair as string]),
      collateralAsset: assertNotNull(
        assets.find(a => a.collateral),
        'Collateral asset not found',
      ),
    };
  }, [assets, payAsset, receiveAsset, prices]);

  const slippagePercent = useMemo(() => new Percent(slippage * 100, 10_000), [
    slippage,
  ]);

  const feePercentage = useMemo(
    () =>
      FPN.fromWei(
        networkId
          ? synthereumConfig[networkId as 42].fees.feePercentage
          : '2000000000000000',
      ),
    [networkId],
  );

  const paySymbol = assetPay?.symbol || null;
  const receiveSymbol = assetReceive?.symbol || null;

  const collateralToken = useMemo(() => {
    if (!networkId || !realmAgent || !realmAgent.activePools.jEUR) return;

    const collateral = realmAgent.activePools.jEUR.collateralToken;
    return new Token(
      networkId,
      collateral.address,
      collateral.decimals,
      collateral.symbol,
    );
  }, [realmAgent, networkId]);
  const shouldSwapAndMint =
    assetPay && !assetPay.synthetic && !assetPay.collateral;
  const shouldRedeemAndSwap =
    assetReceive && !assetReceive.synthetic && !assetReceive.collateral;

  const multicall = useMulticallContext();
  const [maxMintState, setMaxMintState] = useState<{
    realmAgent: typeof realmAgent | null;
    state: null | Record<string, { max: FPN; price: FPN }>;
  }>(defaultMaxMintState);
  useEffect(() => {
    if (!realmAgent) return;

    const idsGlobalPositionData: Record<string, string> = {};
    const idsPoolMembers: Record<
      string,
      {
        id: string;
        collateralAddress: string;
        collateralDecimals: number;
      }
    > = {};
    const idsPoolBalance: Record<
      string,
      {
        id: string;
        collateralAddress: string;
        collateralDecimals: number;
        poolAddress: string;
      }
    > = {};

    const globalPositionData: Record<
      string,
      {
        rawTotalPositionCollateralWei: string;
        totalTokensOutstandingWei: string;
      }
    > = {};
    const balances: Record<
      string,
      { balanceWei: string; decimals: number }
    > = {};

    const newState: Record<string, { max: FPN; price: FPN }> = {};

    const statePrices = store.getState().prices;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const prices: Record<string, FPN> = {};
    const syntheticAssets = assets.filter(asset => asset.collateral);
    for (const asset of syntheticAssets) {
      prices[asset.symbol] = statePrices[asset.pair as string];
    }

    const updateState = debounce(() => {
      setMaxMintState(value => {
        const oldState = value.state;
        if (isEqual(oldState, newState)) {
          return value;
        }

        return { state: newState, realmAgent };
      });
    }, 0);

    const calculateMaxMint = memoize(
      (
        totalTokensOutstandingWei: string,
        rawTotalPositionCollateralWei: string,
        balanceWei: string,
        collateralDecimals: number,
        price: FPN,
      ) => {
        const extraDecimals = 18 - collateralDecimals;
        const r = FPN.fromHex(balanceWei.substr(2), true)
          .increasePrecision(extraDecimals)
          .div(
            FPN.fromHex(rawTotalPositionCollateralWei.substr(2), true)
              .increasePrecision(extraDecimals)
              .div(FPN.fromHex(totalTokensOutstandingWei.substr(2), true))
              .sub(price),
          );
        return r;
      },
    );

    // eslint-disable-next-line guard-for-in
    for (const i in realmAgent.activePools) {
      const pool = realmAgent.activePools[i as 'jEUR']!;
      const { address: contractAddress } = pool.derivative;
      idsGlobalPositionData[
        multicall.add({
          abi: PerpetualPoolPartyAbi,
          calls: [
            {
              reference: '',
              methodName: 'globalPositionData',
              methodParameters: [],
            },
          ],
          contractAddress,
        })
      ] = i;
      const { address, decimals } = pool.collateralToken;
      idsPoolMembers[i] = {
        id: multicall.add({
          abi: PerpetualPoolPartyAbi,
          calls: [
            {
              reference: '',
              methodName: 'getPoolMembers',
              methodParameters: [],
            },
          ],
          contractAddress,
        }),
        collateralAddress: address,
        collateralDecimals: decimals,
      };
    }

    const subsciption = multicall.lastResults$.subscribe(({ results }) => {
      if (!results) return;

      // eslint-disable-next-line guard-for-in
      for (const id in idsGlobalPositionData) {
        const data = results[id];
        if (!data) continue;
        const symbol = idsGlobalPositionData[id];
        const previousData = globalPositionData[symbol];
        const { returnValues } = data.callsReturnContext[0];
        const newData = {
          rawTotalPositionCollateralWei: returnValues[1][0].hex,
          totalTokensOutstandingWei: returnValues[0][0].hex,
        };
        if (!isEqual(previousData, newData)) {
          globalPositionData[symbol] = newData;
          const balance = balances[symbol];
          const price = prices[symbol];
          if (balance && price) {
            const result = calculateMaxMint(
              newData.totalTokensOutstandingWei,
              newData.rawTotalPositionCollateralWei,
              balance.balanceWei,
              balance.decimals,
              price,
            );
            newState[symbol] = { max: result, price };
            updateState();
          }
        }
      }

      // eslint-disable-next-line guard-for-in
      for (const symbol in idsPoolMembers) {
        const { id, collateralDecimals, collateralAddress } = idsPoolMembers[
          symbol
        ];
        const data = results[id];
        if (!data) continue;
        const { returnValues } = data.callsReturnContext[0];

        const poolAddress = returnValues[0][0];

        const info = idsPoolBalance[symbol];
        let newCall = false;
        if (info) {
          if (
            info.collateralAddress !== collateralAddress ||
            !isEqual(info.poolAddress, poolAddress)
          ) {
            newCall = true;
            multicall.remove(info.id);
          } else {
            newCall = false;
          }
        } else {
          newCall = true;
        }

        if (newCall) {
          idsPoolBalance[symbol] = {
            id: multicall.add({
              abi: ERC20Abi,
              calls: [
                {
                  reference: '',
                  methodName: 'balanceOf',
                  methodParameters: [poolAddress],
                },
              ],
              contractAddress: collateralAddress,
            }),
            collateralAddress,
            collateralDecimals,
            poolAddress,
          };
        }
      }

      // eslint-disable-next-line guard-for-in
      for (const symbol in idsPoolBalance) {
        const { id, collateralDecimals } = idsPoolBalance[symbol];
        const data = results[id];
        if (!data) continue;

        const { returnValues } = data.callsReturnContext[0];

        const oldBalance = balances[symbol];
        const newBalance = {
          balanceWei: returnValues[0].hex,
          decimals: collateralDecimals,
        };
        if (!isEqual(oldBalance, newBalance)) {
          balances[symbol] = newBalance;

          const positionData = globalPositionData[symbol];
          const price = prices[symbol];
          if (price && positionData) {
            const result = calculateMaxMint(
              positionData.totalTokensOutstandingWei,
              positionData.rawTotalPositionCollateralWei,
              newBalance.balanceWei,
              newBalance.decimals,
              price,
            );
            newState[symbol] = { max: result, price };
            updateState();
          }
        }
      }
    });

    const unsubscribe = store.subscribe(() => {
      const newPrices = store.getState().prices;
      for (const asset of syntheticAssets) {
        const { symbol, pair } = asset;
        const newPrice = newPrices[pair! as string];
        if (newPrice) {
          const currentPrice = prices[symbol];
          if (
            currentPrice === newPrice ||
            (currentPrice && newPrice && currentPrice.eq(newPrice))
          )
            continue;
          prices[symbol] = newPrice;

          const balance = balances[symbol];
          const data = globalPositionData[symbol];
          if (balance && data) {
            const result = calculateMaxMint(
              data.totalTokensOutstandingWei,
              data.rawTotalPositionCollateralWei,
              balance.balanceWei,
              balance.decimals,
              newPrice,
            );
            newState[symbol] = { max: result, price: newPrice };
            updateState();
          }
        }
      }
    });

    return () => {
      subsciption.unsubscribe();

      unsubscribe();

      // eslint-disable-next-line guard-for-in
      for (const id in idsGlobalPositionData) {
        multicall.remove(id);
      }
      for (const info of Object.values(idsPoolMembers)) {
        multicall.remove(info.id);
      }
      for (const info of Object.values(idsPoolBalance)) {
        multicall.remove(info.id);
      }
    };
  }, [multicall, realmAgent, setMaxMintState, store, assets]);
  const maxMint =
    maxMintState.realmAgent === realmAgent &&
    collateralToken &&
    maxMintState.state;

  const [token0, token1] = useMemo(
    () =>
      isSupportedNetwork(networkId)
        ? shouldSwapAndMint
          ? [
              new Token(
                networkId,
                assetPay!.native
                  ? addresses[networkId as 1][`W${assetPay!.symbol}` as 'WBTC']
                  : addresses[networkId as 1][assetPay!.symbol as 'WBTC'],
                assetPay!.decimals,
                assetPay!.symbol,
                assetPay!.name,
              ),
              collateralToken,
            ]
          : shouldRedeemAndSwap
          ? [
              collateralToken,
              new Token(
                networkId,
                assetReceive!.native
                  ? addresses[networkId as 1][
                      `W${assetReceive!.symbol}` as 'WBTC'
                    ]
                  : addresses[networkId as 1][assetReceive!.symbol as 'WBTC'],
                assetReceive!.decimals,
                assetReceive!.symbol,
                assetReceive!.name,
              ),
            ]
          : [undefined, undefined]
        : [undefined, undefined],
    [
      networkId,
      shouldSwapAndMint,
      shouldRedeemAndSwap,
      assetPay,
      assetReceive,
      collateralToken,
    ],
  );

  const {
    payFPN,
    receiveFPN,
    isPayEqualToZero,
    isReceiveEqualToZero,
  } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const payFPN = new FPN(pay);
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const receiveFPN = new FPN(receive);
    return {
      payFPN,
      receiveFPN,
      isPayEqualToZero: payFPN.eq(ZERO),
      isReceiveEqualToZero: receiveFPN.eq(ZERO),
    };
  }, [pay, receive]);

  const { currencyAmount, calculatedFee } = useMemo(() => {
    if (base === 'pay') {
      if (shouldSwapAndMint) {
        if (token0) {
          return {
            currencyAmount: CurrencyAmount.fromRawAmount(
              token0,
              (isPayEqualToZero ? ONE : payFPN)
                .format(token0.decimals)
                .replace('.', ''),
            ),
            calculatedFee: undefined,
          };
        }
      } else if (token0) {
        // shouldRedeemAndSwap
        const exchange = calcExchange({
          assetPay,
          assetReceive: collateralAsset,
          assetPayPrice,
          assetReceivePrice: FPN.ONE,
          base: 'pay',
          pay,
          receive: '',
          feePercentage,
          collateralAsset,
        });
        return {
          currencyAmount: CurrencyAmount.fromRawAmount(
            token0,
            (isPayEqualToZero ? ONE : exchange!.receiveValue)
              .format(token0.decimals)
              .replace('.', ''),
          ),
          calculatedFee: exchange?.fee,
        };
      }
    } else if (base === 'receive') {
      if (shouldSwapAndMint) {
        if (token1) {
          const exchange = calcExchange({
            assetPay: collateralAsset,
            assetReceive,
            assetPayPrice: FPN.ONE,
            assetReceivePrice,
            base: 'receive',
            pay: '',
            receive,
            feePercentage,
            collateralAsset,
          });
          return {
            currencyAmount: CurrencyAmount.fromRawAmount(
              token1,
              (isReceiveEqualToZero ? ONE : exchange!.payValue)
                .format(token1.decimals)
                .replace('.', ''),
            ),
            calculatedFee: exchange!.fee,
          };
        }
      } else if (token1) {
        // shouldRedeemAndSwap
        return {
          currencyAmount: CurrencyAmount.fromRawAmount(
            token1,
            (isReceiveEqualToZero ? ONE : receiveFPN)
              .format(token1.decimals)
              .replace('.', ''),
          ),
          calculatedFee: undefined,
        };
      }
    }

    return { currencyAmount: undefined, calculatedFee: undefined };
  }, [
    token0,
    token1,
    payFPN,
    receiveFPN,
    isPayEqualToZero,
    isReceiveEqualToZero,
    assetPay,
    assetReceive,
    base,
    collateralAsset,
    pay,
    receive,
    shouldSwapAndMint,
    feePercentage,
    assetPayPrice,
    assetReceivePrice,
  ]);

  const tradeOptions = useMemo(
    () => ({ maxHops: disableMultihops ? 1 : MAX_HOPS }),
    [disableMultihops],
  );
  const { trade, isLoading: tradeIsLoading } =
    base === 'pay'
      ? useV2TradeExactIn(
          currencyAmount,
          currencyAmount && token1,
          tradeOptions,
        )
      : useV2TradeExactOut(
          currencyAmount && token0,
          currencyAmount,
          tradeOptions,
        );

  const isLoading =
    tradeIsLoading ||
    ((shouldSwapAndMint || shouldRedeemAndSwap) && !collateralToken);

  const rate = useMemo(
    () =>
      shouldSwapAndMint || shouldRedeemAndSwap
        ? null
        : calcRate(assetPayPrice, assetReceivePrice),
    [shouldSwapAndMint, shouldRedeemAndSwap, assetPayPrice, assetReceivePrice],
  );

  const executionPrice = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const executionPrice = trade && new FPN(trade.executionPrice.toFixed(18));

    return shouldSwapAndMint || shouldRedeemAndSwap
      ? executionPrice
        ? shouldSwapAndMint
          ? calcRate(
              // Precision will be decreased inside of `calcRate` because the second argument is divided to the first one and both have increased precision
              assetReceivePrice &&
                new FPN(1).increasePrecision().div(assetReceivePrice),
              new FPN(1).increasePrecision().div(executionPrice),
            )
          : calcRate(
              // Precision will be decreased inside of `calcRate` because the second argument is divided to the first one and both have increased precision
              executionPrice.increasePrecision(),
              assetPayPrice &&
                new FPN(1).increasePrecision().div(assetPayPrice),
            )
        : null
      : rate;
  }, [
    shouldSwapAndMint,
    shouldRedeemAndSwap,
    trade,
    assetPayPrice,
    assetReceivePrice,
    rate,
  ]);

  const {
    payValue,
    receiveValue,
    fee,
    transactionCollateral,
    minimumReceiveValue,
    maximumSentValue,
    minimumSynthReceiveValue,
    maximumSynthSentValue,
  } = useMemo(
    () =>
      shouldSwapAndMint
        ? trade
          ? base === 'pay' && !isPayEqualToZero
            ? {
                ...calcExchange({
                  assetPay: collateralAsset,
                  assetReceive,
                  assetPayPrice: FPN.ONE,
                  assetReceivePrice,
                  base,
                  pay: trade.outputAmount.toExact(),
                  receive,
                  feePercentage,
                  collateralAsset,
                }),
                payValue: new FPN(trade.inputAmount.toExact()),
                minimumReceiveValue: new FPN(
                  trade.minimumAmountOut(slippagePercent).toExact(),
                ),
                maximumSentValue: undefined,
                minimumSynthReceiveValue: calcExchange({
                  assetPay: collateralAsset,
                  assetReceive,
                  assetPayPrice: FPN.ONE,
                  assetReceivePrice,
                  base,
                  pay: trade.minimumAmountOut(slippagePercent).toExact(),
                  receive,
                  feePercentage,
                  collateralAsset,
                })!.receiveValue,
                maximumSynthSentValue: undefined,
              }
            : base === 'receive' && !isReceiveEqualToZero
            ? {
                payValue: new FPN(trade.inputAmount.toExact()),
                receiveValue: new FPN(receive),
                fee: calculatedFee!,
                transactionCollateral: undefined,
                minimumReceiveValue: undefined,
                maximumSentValue: new FPN(
                  trade.maximumAmountIn(slippagePercent).toExact(),
                ),
                minimumSynthReceiveValue: undefined,
                maximumSynthSentValue: undefined,
              }
            : empty
          : empty
        : shouldRedeemAndSwap
        ? trade
          ? base === 'pay' && !isPayEqualToZero
            ? {
                payValue: new FPN(pay),
                receiveValue: new FPN(trade.outputAmount.toExact()),
                fee: calculatedFee!,
                transactionCollateral: undefined,
                minimumReceiveValue: new FPN(
                  trade.minimumAmountOut(slippagePercent).toExact(),
                ),
                maximumSentValue: undefined,
                minimumSynthReceiveValue: undefined,
                maximumSynthSentValue: undefined,
              }
            : base === 'receive' && !isReceiveEqualToZero
            ? {
                ...calcExchange({
                  assetPay,
                  assetReceive: collateralAsset,
                  assetPayPrice,
                  assetReceivePrice: FPN.ONE,
                  base,
                  pay,
                  receive: trade.inputAmount.toExact(),
                  feePercentage,
                  collateralAsset,
                }),
                receiveValue: new FPN(trade.outputAmount.toExact()),
                minimumReceiveValue: undefined,
                maximumSentValue: new FPN(
                  trade.maximumAmountIn(slippagePercent).toExact(),
                ),
                minimumSynthReceiveValue: undefined,
                maximumSynthSentValue: calcExchange({
                  assetPay,
                  assetReceive: collateralAsset,
                  assetPayPrice,
                  assetReceivePrice: FPN.ONE,
                  base,
                  pay,
                  receive: trade.maximumAmountIn(slippagePercent).toExact(),
                  feePercentage,
                  collateralAsset,
                })!.payValue,
              }
            : empty
          : empty
        : {
            ...calcExchange({
              assetPay,
              assetReceive,
              assetPayPrice,
              assetReceivePrice,
              base,
              pay,
              receive,
              feePercentage,
              collateralAsset,
            }),
            minimumReceiveValue: undefined,
            maximumSentValue: undefined,
            minimumSynthReceiveValue: undefined,
            maximumSynthSentValue: undefined,
          } || empty,
    [
      assetPay,
      assetReceive,
      assetPayPrice,
      assetReceivePrice,
      base,
      pay,
      receive,
      collateralAsset,
      isPayEqualToZero,
      isReceiveEqualToZero,
      shouldRedeemAndSwap,
      shouldSwapAndMint,
      trade,
      calculatedFee,
      slippagePercent,
      feePercentage,
    ],
  );

  const payString = payValue?.format() || '';
  const receiveString = receiveValue?.format() || '';

  return {
    fee,
    feePercentage,
    base,
    pay,
    receive,
    paySymbol,
    receiveSymbol,
    assetPay,
    assetReceive,
    assetPayPrice,
    assetReceivePrice,
    rate,
    executionPrice,
    payValue,
    payString,
    receiveValue,
    receiveString,
    transactionCollateral,
    shouldRedeemAndSwap,
    shouldSwapAndMint,
    minimumReceiveValue,
    maximumSentValue,
    minimumSynthReceiveValue,
    maximumSynthSentValue,
    isLoading,
    routeNotFound: !isLoading && !trade?.route,
    inputAmount: trade?.inputAmount.toFixed().replace('.', ''),
    outputAmount: trade?.outputAmount.toFixed().replace('.', ''),
    path: trade?.route.path,
    maxMint,
  };
}

function calcRate(inputPrice?: FPN | null, outputPrice?: FPN | null) {
  if (!inputPrice || !outputPrice) {
    return null;
  }

  return inputPrice.div(outputPrice);
}

function defaultMaxMintState() {
  return { realmAgent: null, state: null };
}
