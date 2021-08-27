import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

const ether = 10n ** 18n;

export function divideBigInt(a: bigint, b: bigint): StringAmount {
  const exp = (a * ether) / b;
  return exp.toString() as StringAmount;
}
