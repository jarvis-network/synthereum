import BN from 'bn.js';
import { fromWei, toWei } from 'web3-utils';

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

  constructor(value: string | number | BN, isWei?: boolean) {
    let val = prepareValue(value);
    if (!isWei) {
      val = toWei(val);
    }
    this.number = new BN(val);
  }

  static ZERO = new FixedPointNumber(0);

  static ONE = new FixedPointNumber(1);

  static fromWei(value: string | number | BN): FixedPointNumber {
    return new FixedPointNumber(value, true);
  }

  static sum(values: FixedPointNumber[]): FixedPointNumber {
    return values.reduce(
      (total, current) => total.add(current),
      new FixedPointNumber(0),
    );
  }

  static fromHex(value: string, isWei?: boolean): FixedPointNumber {
    return new FixedPointNumber(new BN(value, 'hex'), isWei);
  }

  toString(base?: number | 'hex', length?: number): string {
    return this.number.toString(base, length);
  }

  toJSON(): string {
    return this.number.toJSON();
  }

  format(decimals = Infinity): string {
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

  toNumber(decimals?: number): number {
    return Number(this.format(decimals));
  }

  get bn(): BN {
    return this.number;
  }

  add(num: FixedPointNumber): FixedPointNumber {
    return FixedPointNumber.fromWei(this.number.add(num.bn));
  }

  sub(num: FixedPointNumber): FixedPointNumber {
    return FixedPointNumber.fromWei(this.number.sub(num.bn));
  }

  div(num: FixedPointNumber): FixedPointNumber {
    return FixedPointNumber.fromWei(this.increasePrecision().bn.div(num.bn));
  }

  mul(num: FixedPointNumber): FixedPointNumber {
    return FixedPointNumber.fromWei(
      this.number.mul(num.bn),
    ).decreasePrecision();
  }

  gt(num: FixedPointNumber): boolean {
    return this.number.gt(num.bn);
  }

  gte(num: FixedPointNumber): boolean {
    return this.number.gte(num.bn);
  }

  lt(num: FixedPointNumber): boolean {
    return this.number.lt(num.bn);
  }

  lte(num: FixedPointNumber): boolean {
    return this.number.lte(num.bn);
  }

  eq(num: FixedPointNumber): boolean {
    return this.number.eq(num.bn);
  }

  increasePrecision(by = 18): FixedPointNumber {
    return FixedPointNumber.fromWei(
      this.number.mul(new BN(10).pow(new BN(by))),
    );
  }

  decreasePrecision(by = 18): FixedPointNumber {
    return FixedPointNumber.fromWei(
      this.number.div(new BN(10).pow(new BN(by))),
    );
  }

  pow(power: number): FixedPointNumber {
    if (power === 0) return new FixedPointNumber(1);
    if (power === 1) return this;
    return Array.from({ length: power - 1 }).reduce<FixedPointNumber>(
      accumulator => accumulator.mul(this),
      this,
    );
  }
}

export { FixedPointNumber as FPN };
