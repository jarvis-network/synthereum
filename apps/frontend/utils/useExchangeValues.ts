import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { useReduxSelector } from '@/state/useReduxSelector';
import { useRate } from '@/utils/useRate';
import { FEE } from '@/data/fee';

export const useExchangeValues = () => {
  const {
    base,
    pay,
    receive,
    payAsset: paySymbol,
    receiveAsset: receiveSymbol,
    assetPay,
    assetReceive,
  } = useReduxSelector(state => ({
    ...state.exchange,
    assetPay: state.assets.list.find(a => a.symbol === state.exchange.payAsset),
    assetReceive: state.assets.list.find(
      a => a.symbol === state.exchange.receiveAsset,
    ),
  }));

  const rate = useRate(paySymbol, receiveSymbol);

  const payValue =
    base === 'pay'
      ? new FPN(pay)
      : rate
      ? new FPN(receive)
          .div(rate.rate)
          .add(new FPN(receive).div(rate.rate).mul(FEE))
      : null;
  const payString = payValue ? payValue.format() : '';

  const receiveValue =
    base === 'receive'
      ? new FPN(receive)
      : rate
      ? new FPN(pay).mul(rate.rate).sub(new FPN(pay).mul(rate.rate).mul(FEE))
      : null;
  const receiveString = receiveValue ? receiveValue.format() : '';

  const fee = payValue ? payValue.mul(FEE) : null;

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
  };
};
