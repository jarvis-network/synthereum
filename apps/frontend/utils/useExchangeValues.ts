import { useReduxSelector } from '@/state/useReduxSelector';
import { useRate } from '@/utils/useRate';
import { FEE } from '@/data/fee';
import { calcExchange } from '@/utils/calcExchange';
import { primaryCollateralSymbol } from '@jarvis-network/synthereum-contracts/dist/config';

export const useExchangeValues = () => {
  const {
    base,
    pay,
    receive,
    assetPay,
    assetReceive,
    collateralAsset,
  } = useReduxSelector(state => ({
    ...state.exchange,
    assetPay: state.assets.list.find(a => a.symbol === state.exchange.payAsset),
    assetReceive: state.assets.list.find(
      a => a.symbol === state.exchange.receiveAsset,
    ),
    collateralAsset: state.assets.list.find(
      a => a.symbol === primaryCollateralSymbol,
    )!,
  }));

  const paySymbol = assetPay?.symbol || null;
  const receiveSymbol = assetReceive?.symbol || null;

  const rate = useRate(paySymbol, receiveSymbol);

  const { payValue, receiveValue, fee, transactionCollateral } =
    calcExchange({
      assetPay,
      assetReceive,
      base,
      pay,
      receive,
      feePercentage: FEE,
      collateralAsset,
    }) || {};

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
