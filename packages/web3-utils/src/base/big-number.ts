import BN from 'bn.js';
import { fromWei, toWei } from 'web3-utils';
import { mapReduce } from './array-fp-utils';
import { assertIsNumericString, isObject } from './asserts';
import { Tagged } from './tagged-type';
import { Unit } from 'web3-utils';

export type AmountOf<U extends Unit> = Tagged<string, U>;
export type Amount = AmountOf<'wei'>;

export function wei(str: string): Amount {
  assertIsNumericString(str);
  return str as Amount;
}

export const zero = new BN(0);
export const one = new BN(1);
export const negativeOne = new BN(-1);
export const maxUint256 = new BN(
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'hex',
);

export function mapSumBN<T>(array: T[], getter: (elem: T) => BN) {
  return mapReduce(array, zero, getter, (curr, next) => curr.add(next));
}

export function sumBN(listOfNumbers: BN[]) {
  return mapSumBN(listOfNumbers, x => x);
}

export function weiToNumber(wei: string) {
  return fromBNToNumber(new BN(wei));
}

export function fromBNToDecimalString(bn: BN) {
  return fromWei(bn);
}

export function formatBN(bn: BN) {
  return fromBNToNumber(bn).toFixed(2);
}

export function fromBNToNumber(bn: BN) {
  return Number.parseFloat(fromBNToDecimalString(bn));
}

export function toBN(str: string) {
  return new BN(toWei(str.replace(/,/g, '')));
}

export function replaceBN(obj: unknown) {
  if (BN.isBN(obj)) {
    return formatBN(obj);
  } else if (!isObject(obj)) {
    return obj;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = replaceBN(value);
  }
  return result;
}
