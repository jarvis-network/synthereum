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

  let fee = null;
  let payValue = null;
  let receiveValue = null;
  let netCollateral = null;
  let grossCollateral = null;
  let transactionCollateral = null;

  // eslint-disable-next-line no-empty
  if (paySymbol === receiveSymbol || !assetPay?.price || !assetReceive?.price) {
  } else if (paySymbol === 'USDC') {
    // mint
    if (base === 'pay') {
      payValue = new FPN(pay);
      grossCollateral = payValue;
      netCollateral = grossCollateral.div(new FPN(1).add(FEE));
      transactionCollateral = netCollateral;
      receiveValue = netCollateral.div(assetReceive.price);
    } else {
      receiveValue = new FPN(receive);
      netCollateral = receiveValue.mul(assetReceive.price);
      grossCollateral = netCollateral.mul(new FPN(1).add(FEE));
      transactionCollateral = netCollateral;
      payValue = grossCollateral;
    }
  } else if (receiveSymbol === 'USDC') {
    // redeem
    if (base === 'pay') {
      payValue = new FPN(pay);
      grossCollateral = payValue.mul(assetPay.price);
      netCollateral = grossCollateral.mul(new FPN(1).sub(FEE));
      transactionCollateral = grossCollateral;
      receiveValue = netCollateral;
    } else {
      receiveValue = new FPN(receive);
      netCollateral = receiveValue;
      grossCollateral = netCollateral.div(new FPN(1).sub(FEE));
      transactionCollateral = grossCollateral;
      payValue = grossCollateral.div(assetPay.price);
    }
  } else {
    // exchange
    // eslint-disable-next-line no-lonely-if
    if (base === 'pay') {
      payValue = new FPN(pay);
      grossCollateral = payValue.mul(assetPay.price);
      netCollateral = grossCollateral.mul(new FPN(1).sub(FEE));
      transactionCollateral = grossCollateral;
      receiveValue = netCollateral.div(assetReceive.price);
    } else {
      receiveValue = new FPN(receive);
      netCollateral = receiveValue.mul(assetReceive.price);
      grossCollateral = netCollateral.div(new FPN(1).sub(FEE));
      transactionCollateral = grossCollateral;
      payValue = grossCollateral.div(assetPay.price);
    }
  }

  if (grossCollateral && netCollateral) {
    fee = grossCollateral.sub(netCollateral);
  }

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
