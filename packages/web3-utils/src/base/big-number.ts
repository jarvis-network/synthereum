import BN from 'bn.js';
import { fromWei } from 'web3-utils';

export function fromBNToDecimalString(bn: BN) {
  return fromWei(bn);
}
