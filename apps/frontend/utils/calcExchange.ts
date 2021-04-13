import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { Asset } from '@/data/assets';
import { State } from '@/state/initialState';

interface Data {
  assetPay: Asset | undefined;
  assetReceive: Asset | undefined;
  base: State['exchange']['base'];
  pay: State['exchange']['pay'];
  receive: State['exchange']['receive'];
  fee: FPN;
}

export const calcExchange = ({
  assetPay,
  assetReceive,
  base,
  pay,
  receive,
  fee,
}: Data) => {
  let payValue = null;
  let receiveValue = null;
  let netCollateral = null;
  let grossCollateral = null;
  let transactionCollateral = null;

  const paySymbol = assetPay?.symbol;
  const receiveSymbol = assetReceive?.symbol;

  if (paySymbol === receiveSymbol || !assetPay?.price || !assetReceive?.price) {
    return {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    };
  }

  if (paySymbol === 'USDC') {
    // mint
    if (base === 'pay') {
      payValue = new FPN(pay);
      grossCollateral = payValue;
      netCollateral = grossCollateral.div(new FPN(1).add(fee));
      transactionCollateral = netCollateral;
      receiveValue = netCollateral.div(assetReceive.price);
    } else {
      receiveValue = new FPN(receive);
      netCollateral = receiveValue.mul(assetReceive.price);
      grossCollateral = netCollateral.mul(new FPN(1).add(fee));
      transactionCollateral = netCollateral;
      payValue = grossCollateral;
    }
  } else if (receiveSymbol === 'USDC') {
    // redeem
    if (base === 'pay') {
      payValue = new FPN(pay);
      grossCollateral = payValue.mul(assetPay.price);
      netCollateral = grossCollateral.mul(new FPN(1).sub(fee));
      transactionCollateral = grossCollateral;
      receiveValue = netCollateral;
    } else {
      receiveValue = new FPN(receive);
      netCollateral = receiveValue;
      grossCollateral = netCollateral.div(new FPN(1).sub(fee));
      transactionCollateral = grossCollateral;
      payValue = grossCollateral.div(assetPay.price);
    }
  } else {
    // exchange
    // eslint-disable-next-line no-lonely-if
    if (base === 'pay') {
      payValue = new FPN(pay);
      grossCollateral = payValue.mul(assetPay.price);
      netCollateral = grossCollateral.mul(new FPN(1).sub(fee));
      transactionCollateral = grossCollateral;
      receiveValue = netCollateral.div(assetReceive.price);
    } else {
      receiveValue = new FPN(receive);
      netCollateral = receiveValue.mul(assetReceive.price);
      grossCollateral = netCollateral.div(new FPN(1).sub(fee));
      transactionCollateral = grossCollateral;
      payValue = grossCollateral.div(assetPay.price);
    }
  }

  return {
    payValue,
    receiveValue,
    netCollateral,
    grossCollateral,
    transactionCollateral,
  };
};
