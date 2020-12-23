import { useReduxSelector } from '@/state/useReduxSelector';
import { useRate } from '@/utils/useRate';
import { FEE } from '@/data/fee';
import { calcExchange } from '@/utils/calcExchange';

export const useExchangeValues = () => {
  const { base, pay, receive, assetPay, assetReceive } = useReduxSelector(
    state => ({
      ...state.exchange,
      assetPay: state.assets.list.find(
        a => a.symbol === state.exchange.payAsset,
      ),
      assetReceive: state.assets.list.find(
        a => a.symbol === state.exchange.receiveAsset,
      ),
    }),
  );

  const paySymbol = assetPay?.symbol || null;
  const receiveSymbol = assetReceive?.symbol || null;

  const rate = useRate(paySymbol, receiveSymbol);

  const {
    payValue,
    receiveValue,
    netCollateral,
    grossCollateral,
    transactionCollateral,
  } = calcExchange({
    assetPay,
    assetReceive,
    base,
    pay,
    receive,
    fee: FEE,
  });

  const fee =
    grossCollateral && netCollateral
      ? grossCollateral.sub(netCollateral)
      : null;

  const payString = payValue?.format() || '';
  const receiveString = receiveValue?.format() || '';

  return {
    fee,
    base,
    pay,
    receive,
    paySymbol,
    receiveSymbol,
    assetPay,
    assetReceive,
    rate,
    payValue,
    payString,
    receiveValue,
    receiveString,
    transactionCollateral,
  };
};
