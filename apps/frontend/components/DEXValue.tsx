import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import {
  useBehaviorSubject,
  useCoreObservables,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { useV2TradeExactIn } from '@/utils/uniswap';
import { addresses } from '@/data/addresses';
import { isSupportedNetwork } from '@jarvis-network/synthereum-contracts/dist/config';
import { useMemo } from 'use-memo-one';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Asset } from '@/data/assets';
import { BehaviorSubject } from 'rxjs';

type ContextValue = Readonly<Record<string, BehaviorSubject<string>>>;
type Context$ = BehaviorSubject<ContextValue>;
const context = createContext<Context$ | null>(null);

export function DEXValueContextProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [$] = useState<Context$>(
    () => new BehaviorSubject<ContextValue>(Object.freeze({})),
  );
  return <context.Provider value={$}>{children}</context.Provider>;
}

function useDEXValueContext() {
  const $ = useContext(context);
  if (!$) throw new Error('DEXValueContext not provided');
  return $;
}

interface Props {
  asset: Asset;
  amount: FPN;
  wrapper: (children: ReactNode) => JSX.Element;
}

export function DEXValue({
  asset,
  amount,
  wrapper,
}: Props): JSX.Element | null {
  const { chainId: networkId } = useWeb3();
  const realmAgent = useBehaviorSubject(useCoreObservables().realmAgent$);

  const $ = useDEXValueContext();
  const subject = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const subject = new BehaviorSubject<string>('0.00');
    $.next(Object.freeze({ ...$.value, [asset.symbol]: subject }));
    return subject;
  }, [$, asset]);
  useEffect(
    () => () => {
      if ($.value[asset.symbol] === subject) {
        const copy = { ...$.value };
        delete copy[asset.symbol];
        $.next(Object.freeze(copy));
      }
    },
    [subject, $, asset],
  );

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

  const currencyAmount = useMemo(() => {
    if (!isSupportedNetwork(networkId)) return;

    const token = new Token(
      networkId,
      asset.native
        ? addresses[networkId as 1][`W${asset.symbol}` as 'WBTC']
        : addresses[networkId as 1][asset.symbol as 'WBTC'],
      asset.decimals,
      asset.symbol,
      asset.name,
    );
    return CurrencyAmount.fromRawAmount(
      token,
      amount.format(token.decimals).replace('.', ''),
    );
  }, [networkId, asset, amount]);

  const { trade } = useV2TradeExactIn(currencyAmount, collateralToken);
  const value = trade
    ? new FPN(trade.outputAmount.toExact()).format(2)
    : amount.eq(FPN.ZERO)
    ? '0.00'
    : '-.--';

  useEffect(() => {
    subject.next(`${amount.format()}|${value}`);
  });

  return wrapper(value);
}

export function DEXValueFromContext({
  asset,
  wrapper,
  amount,
}: Props): JSX.Element {
  const values = useBehaviorSubject(useDEXValueContext());

  const $ = values[asset.symbol];
  if ($) {
    // eslint-disable-next-line react/jsx-pascal-case
    return <_DEXValueFromContext $={$} wrapper={wrapper} amount={amount} />;
  }

  if (amount.eq(FPN.ZERO)) {
    wrapper('0.00');
  }

  return wrapper('-.--');
}

// eslint-disable-next-line no-underscore-dangle
function _DEXValueFromContext({
  $,
  wrapper,
  amount,
}: {
  $: BehaviorSubject<string>;
  wrapper: Props['wrapper'];
  amount: Props['amount'];
}) {
  const [contextAmount, usdAmount] = useBehaviorSubject($).split('|');
  if (contextAmount !== amount.format()) {
    return wrapper('-.--');
  }

  return wrapper(usdAmount);
}
