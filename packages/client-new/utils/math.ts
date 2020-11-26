import BN from 'bn.js';

export const arraySumBN = (values: BN[]) =>
  values.reduce((result, value) => result.add(value), new BN('0'));
