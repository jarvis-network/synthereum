import BN from 'bn.js';
import { fromWei, toWei, Unit } from 'web3-utils';

import { mapReduce } from './array-fp-utils';
import { assertIsInteger, assertIsNumericString, isObject } from './asserts';
import { Tagged } from './tagged-type';

export const ether = new BN(10).pow(new BN(18));
export const zero = new BN(0);
export const one = new BN(1);
export const negativeOne = new BN(-1);
export const maxUint256 = new BN(
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'hex',
);

export type AmountOf<U extends Unit> = Tagged<BN, U>;
export type Amount = AmountOf<'wei'>;

export type StringAmountOf<U extends Unit> = Tagged<string, U>;
export type StringAmount = StringAmountOf<'wei'>;

export function weiString(str: string): StringAmount {
  assertIsInteger(str);
  return str as StringAmount;
}

export function toWeiString(str: string): StringAmount {
  return toWei(assertIsNumericString(str)) as StringAmount;
}

export function wei(str: string | number): Amount {
  return new BN(str, 10) as Amount;
}

export function numberToWei(n: number): Amount {
  return new BN(toWei(n.toFixed(18))) as Amount;
}

export function scale(a: BN, b: number): BN {
  return a.mul(numberToWei(b)).div(ether);
}

export function mapSumBN<T, U extends Unit>(
  array: T[],
  getter: (elem: T) => AmountOf<U>,
): AmountOf<U> {
  return mapReduce(
    array,
    zero as AmountOf<U>,
    getter,
    (curr, next) => curr.add(next) as AmountOf<U>,
  );
}

export function sumBN<U extends Unit>(
  listOfNumbers: AmountOf<U>[],
): AmountOf<U> {
  return mapSumBN(listOfNumbers, x => x);
}

export function weiToNumber(weiStr: string): number {
  return fromBNToNumber(new BN(weiStr));
}

export function fromBNToDecimalString(bn: BN): string {
  return fromWei(bn);
}

export function formatAmount(amount: Amount, decimals = 2): string {
  const rawStr = amount.toString(10);
  const nativeNumDecimals = 18;
  const integerPart = rawStr.slice(0, -nativeNumDecimals).padStart(1, '0');
  const decimalPart = rawStr
    .slice(-nativeNumDecimals)
    .padStart(nativeNumDecimals, '0');
  return `${integerPart}.${decimalPart.slice(0, decimals)}`;
}

export function fromBNToNumber(bn: BN): number {
  return Number.parseFloat(fromBNToDecimalString(bn));
}

export function toBN(str: string): BN {
  return new BN(toWei(str.replace(/,/g, '')));
}

export function replaceBN(obj: unknown): unknown {
  if (BN.isBN(obj)) {
    return formatAmount(obj as Amount);
  }
  if (!isObject(obj)) {
    return obj;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = replaceBN(value);
  }
  return result;
}
