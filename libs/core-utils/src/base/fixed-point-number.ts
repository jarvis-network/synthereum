import BN from 'bn.js';
import { fromWei, toWei } from 'web3-utils';

import { ether as BnEther } from './big-number';

const stringifyValue = (val: string | number | BN) => {
  if (val instanceof BN) {
    return val.toString();
  }
  if (typeof val === 'string') {
    return val.trim();
  }
  const s = String(val);
  if (s.includes('e')) {
    // we should avoid toFixed because it acts weird sometimes, returning
    // incorrectly rounded values, like (3.14).toFixed(16)
    return val.toFixed(18);
  }
  return s;
};

const prepareValue = (val: string | number | BN) => {
  const value = stringifyValue(val);
  if (Number(value.match(/\./g)?.length) > 1) {
    throw new TypeError('Number cannot contain more than one dot.');
  }
  if (value === '.' || !value) {
    return '0';
  }

  const [whole, fraction_] = value.split('.');
  let fraction = fraction_;
  if (fraction && fraction.length > 18) {
    fraction = fraction.substr(0, 18);
    return [whole, fraction].join('.');
  }

  return value;
};

class FixedPointNumber {
  private readonly number: BN;

  static zero = new FixedPointNumber(0);

  static one = new FixedPointNumber(1);

  static ether = new FixedPointNumber(BnEther);

  constructor(value: string | number | BN, isWei?: boolean) {
    let val = prepareValue(value);
    if (!isWei) {
      val = toWei(val);
    }
    this.number = new BN(val);
  }

  static fromWei(value: string | number | BN) {
    return new FixedPointNumber(value, true);
  }

  static sum(values: FixedPointNumber[]) {
    return values.reduce(
      (total, current) => total.add(current),
      new FixedPointNumber(0),
    );
  }

  toString(base?: number | 'hex', length?: number) {
    return this.number.toString(base, length);
  }

  toJSON() {
    return this.number.toJSON();
  }

  format(decimals = Infinity) {
    if (decimals !== Infinity) {
      const n = fromWei(this.number);
      const [whole, fraction_] = n.split('.');
      let fraction = fraction_;
      if (!decimals) {
        return whole;
      }

      fraction = fraction || '';
      return `${whole}.${fraction.padEnd(decimals, '0').substr(0, decimals)}`;
    }
    return fromWei(this.number);
  }

  toNumber(decimals?: number) {
    return Number(this.format(decimals));
  }

  get bn() {
    return this.number;
  }

  add(num: FixedPointNumber) {
    return FixedPointNumber.fromWei(this.number.add(num.bn));
  }

  sub(num: FixedPointNumber) {
    return FixedPointNumber.fromWei(this.number.sub(num.bn));
  }

  div(num: FixedPointNumber) {
    return FixedPointNumber.fromWei(this.increasePrecision().bn.div(num.bn));
  }

  mul(num: FixedPointNumber) {
    return FixedPointNumber.fromWei(
      this.number.mul(num.bn),
    ).decreasePrecision();
  }

  gt(num: FixedPointNumber) {
    return this.number.gt(num.bn);
  }

  gte(num: FixedPointNumber) {
    return this.number.gte(num.bn);
  }

  lt(num: FixedPointNumber) {
    return this.number.lt(num.bn);
  }

  lte(num: FixedPointNumber) {
    return this.number.lte(num.bn);
  }

  increasePrecision(by = 18) {
    return FixedPointNumber.fromWei(
      this.number.mul(new BN(10).pow(new BN(by))),
    );
  }

  decreasePrecision(by = 18) {
    return FixedPointNumber.fromWei(
      this.number.div(new BN(10).pow(new BN(by))),
    );
  }
}

export { FixedPointNumber as FPN };
