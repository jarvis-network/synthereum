import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { Asset } from '@/data/assets';
import { State } from '@/state/initialState';

interface Arguments {
  collateralAsset: Asset;
  assetPay: Asset | undefined;
  assetReceive: Asset | undefined;
  assetPayPrice?: FPN;
  assetReceivePrice?: FPN;
  base: State['exchange']['base'];
  pay: State['exchange']['pay'];
  receive: State['exchange']['receive'];
  feePercentage: FPN;
}

type Calculated = {
  payValue: FPN;
  receiveValue: FPN;
  fee: FPN;
  transactionCollateral?: FPN;
} | null;

const ZERO_BN = new FPN(0).bn;

export function calcExchange({
  assetPay,
  assetReceive,
  assetPayPrice,
  assetReceivePrice,
  base,
  pay,
  receive,
  feePercentage,
  collateralAsset,
}: Arguments): Calculated {
  const paySymbol = assetPay?.symbol;
  const receiveSymbol = assetReceive?.symbol;

  if (
    paySymbol === receiveSymbol ||
    !assetPayPrice ||
    !assetReceivePrice ||
    !assetPay ||
    !assetReceive
  ) {
    return null;
  }

  if (paySymbol === collateralAsset.symbol) {
    // mint
    if (base === 'pay') {
      const payValue = new FPN(pay);
      return mintCollateral(
        payValue,
        assetReceivePrice,
        feePercentage,
        collateralAsset.decimals,
      );
    }

    const receiveValue = new FPN(receive);
    return mintTokens(
      receiveValue,
      assetReceivePrice,
      feePercentage,
      collateralAsset.decimals,
      assetPay.decimals,
    );
  }

  if (receiveSymbol === collateralAsset.symbol) {
    // redeem
    if (base === 'pay') {
      const payValue = new FPN(pay);
      return redeemTokens(
        payValue,
        assetPayPrice,
        feePercentage,
        collateralAsset.decimals,
      );
    }

    const receiveValue = new FPN(receive);
    if (receiveValue.bn.eq(ZERO_BN)) return null;

    return redeemCollateral(
      receiveValue,
      assetPayPrice,
      feePercentage,
      collateralAsset.decimals,
      assetPay.decimals,
    );
  }
  // exchange
  if (base === 'pay') {
    const payValue = new FPN(pay);
    return exchangePay(
      payValue,
      assetPayPrice,
      assetReceivePrice,
      feePercentage,
      collateralAsset.decimals,
    );
  }

  const receiveValue = new FPN(receive);
  return exchangeReceive(
    receiveValue,
    assetPayPrice,
    assetReceivePrice,
    feePercentage,
    collateralAsset.decimals,
    assetPay.decimals,
  );
}

const TEN_WITH_TWELVE_ZEROS = new FPN(10).pow(18 - 6);

function getTenPowEighteenMinus(amount: number) {
  if (amount === 6) return TEN_WITH_TWELVE_ZEROS;

  return new FPN(10).pow(18 - amount);
}

function calcReceive<R, T extends Array<R>>(
  receiveValue: FPN,
  startingPayValue: FPN,
  startingFee: FPN,
  payValueDecimals: number,
  args: T,
  reverseFunction: (
    payValue: FPN,
    ...otherArguments: T
  ) => { receiveValue: FPN; fee: FPN },
) {
  const integerLength = startingPayValue.format(0).length;
  const initialStep = new FPN(
    integerLength > 0 ? '1'.padEnd(integerLength, '0') : '1',
  );
  const result = Array.from({
    length: payValueDecimals + (integerLength > 1 ? integerLength - 1 : 0),
  }).reduce<{
    fee: FPN;
    payValue: FPN;
  }>(
    (values, _, i) => {
      const last = i + 1 === payValueDecimals;
      const step = initialStep.mul(new FPN('0.1').pow(1 + i));
      const lastValues = { ...values };
      const currentValues = { ...values };

      let calc: ReturnType<typeof reverseFunction>;
      function doCalc() {
        calc = reverseFunction(currentValues.payValue, ...args);
      }
      doCalc();
      while (receiveValue.gt(calc!.receiveValue)) {
        lastValues.payValue = currentValues.payValue;
        lastValues.payValue = currentValues.payValue;

        currentValues.payValue = currentValues.payValue.add(step);
        doCalc();
      }

      currentValues.fee = calc!.fee;
      lastValues.fee = calc!.fee;

      return last ? currentValues : lastValues;
    },
    { fee: startingFee, payValue: startingPayValue },
  ) as {
    fee: FPN;
    payValue: FPN;
    receiveValue: FPN;
  };
  result.receiveValue = receiveValue;
  return result;
}

function mintCollateral(
  payValue: FPN,
  price: FPN,
  feePercentage: FPN,
  collateralDecimals: number,
) {
  const fee = payValue.mul(feePercentage);

  const collateralAmountAfterFee = payValue.sub(fee);

  const receiveValue = calculateNumberOfTokens(
    price,
    collateralDecimals,
    collateralAmountAfterFee,
  ).div(getTenPowEighteenMinus(collateralDecimals));

  return { payValue, fee, receiveValue };
}

function mintTokens(
  receiveValue: FPN,
  price: FPN,
  feePercentage: FPN,
  collateralDecimals: number,
  payValueDecimals: number,
) {
  const value = receiveValue.mul(price);
  const startingFee = value.mul(feePercentage);
  const startingPayValue = value.add(startingFee);

  return calcReceive(
    receiveValue,
    startingPayValue,
    startingFee,
    payValueDecimals,
    [price, feePercentage, collateralDecimals],
    mintCollateral,
  );
}

function redeemTokens(
  payValue: FPN,
  price: FPN,
  feePercentage: FPN,
  collateralDecimals: number,
) {
  const collateralBeforeFee = calculateCollateralAmount(
    price,
    collateralDecimals,
    payValue,
  );

  const fee = collateralBeforeFee.mul(feePercentage);

  const receiveValue = collateralBeforeFee
    .sub(fee)
    .mul(getTenPowEighteenMinus(collateralDecimals));
  return {
    payValue,
    fee: fee.mul(getTenPowEighteenMinus(collateralDecimals)),
    receiveValue,
  };
}

function redeemCollateral(
  receiveValue: FPN,
  price: FPN,
  feePercentage: FPN,
  collateralDecimals: number,
  payValueDecimals: number,
) {
  const startingFee = receiveValue.mul(feePercentage);
  const startingPayValue = receiveValue.sub(startingFee).div(price);

  return calcReceive(
    receiveValue,
    startingPayValue,
    startingFee,
    payValueDecimals,
    [price, feePercentage, collateralDecimals],
    redeemTokens,
  );
}

function exchangePay(
  payValue: FPN,
  payPrice: FPN,
  receivePrice: FPN,
  feePercentage: FPN,
  collateralDecimals: number,
) {
  const collateralAmountBeforeFee = calculateCollateralAmount(
    payPrice,
    collateralDecimals,
    payValue,
  );

  const fee = collateralAmountBeforeFee.mul(feePercentage);

  const collateralAmount = collateralAmountBeforeFee.sub(fee);

  const receiveValue = calculateNumberOfTokens(
    receivePrice,
    collateralDecimals,
    collateralAmount,
  );

  return {
    payValue,
    receiveValue,
    fee: fee.mul(getTenPowEighteenMinus(collateralDecimals)),
  };
}

function exchangeReceive(
  receiveValue: FPN,
  payPrice: FPN,
  receivePrice: FPN,
  feePercentage: FPN,
  collateralDecimals: number,
  payValueDecimals: number,
) {
  const value = receiveValue.mul(receivePrice);
  const startingFee = value.mul(feePercentage);
  const valueWithFee = value.add(startingFee);
  const startingPayValue = valueWithFee.div(payPrice);

  return calcReceive(
    receiveValue,
    startingPayValue,
    startingFee,
    payValueDecimals,
    [payPrice, receivePrice, feePercentage, collateralDecimals],
    exchangePay,
  );
}

function calculateCollateralAmount(
  price: FPN,
  collateralDecimals: number,
  numTokens: FPN,
) {
  return numTokens.mul(price).div(getTenPowEighteenMinus(collateralDecimals));
}

function calculateNumberOfTokens(
  price: FPN,
  collateralDecimals: number,
  collateralAmount: FPN,
) {
  return collateralAmount
    .mul(getTenPowEighteenMinus(collateralDecimals))
    .div(price);
}
