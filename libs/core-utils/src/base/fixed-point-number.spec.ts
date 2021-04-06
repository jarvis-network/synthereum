import BN from 'bn.js';

import { FPN } from './fixed-point-number';

const one = new FPN(1);
const twelve = new FPN(12);
const almostPI = new FPN(3.14);
const stringifiedFloat = new FPN('1.005');
const stringifiedWithoutFraction = new FPN('5.');
const stringifiedWithoutWhole = new FPN('.5');
const justDot = new FPN('.');
const empty = new FPN('0');
const oneTwoThreeFour = new FPN(new BN(1234));
const wei69 = FPN.fromWei(new BN('69000000000000000000'));
const negativeFiveAndHalf = new FPN(-5.5);
const negativeWei = FPN.fromWei('-11000000000000000000');
const negativeBN = new FPN(new BN('-123'));
const fromHex = FPN.fromWei(new BN('55f9ba352e70b8000', 16));

describe('FPN (Fixed Point Number)', () => {
  it('should implement `toString()`', () => {
    expect(one.toString(10)).toEqual('1000000000000000000');
    expect(twelve.toString(10)).toEqual('12000000000000000000');
    expect(almostPI.toString(10)).toEqual('3140000000000000000');
    expect(stringifiedFloat.toString(10)).toEqual('1005000000000000000');
    expect(stringifiedWithoutFraction.toString(10)).toEqual(
      '5000000000000000000',
    );
    expect(stringifiedWithoutWhole.toString(10)).toEqual('500000000000000000');
    expect(justDot.toString(10)).toEqual('0');
    expect(empty.toString(10)).toEqual('0');
    expect(oneTwoThreeFour.toString(10)).toEqual('1234000000000000000000');
    expect(wei69.toString(10)).toEqual('69000000000000000000');
    expect(negativeFiveAndHalf.toString(10)).toEqual('-5500000000000000000');
    expect(negativeWei.toString(10)).toEqual('-11000000000000000000');
    expect(negativeBN.toString(10)).toEqual('-123000000000000000000');
    expect(fromHex.toString(10)).toEqual('99123000000000000000');
  });

  it('should implement `add()`, `sub()`, `mul()`, and `div()`', () => {
    expect(one.add(one).toString(10)).toEqual('2000000000000000000');
    expect(one.add(new FPN(1)).toString(10)).toEqual('2000000000000000000');
    expect(one.sub(one).toString(10)).toEqual('0');
    expect(one.sub(one).sub(one).toString(10)).toEqual('-1000000000000000000');
    expect(wei69.div(new FPN(3)).toString(10)).toEqual('23000000000000000000');
    expect(new FPN(98).div(new FPN(99)).toString(10)).toEqual(
      '989898989898989898',
    );
    expect(wei69.mul(new FPN(3)).toString(10)).toEqual('207000000000000000000');
  });

  it('should implement `format()`', () => {
    expect(new FPN(98).div(new FPN(99)).format()).toEqual(
      '0.989898989898989898',
    );
    expect(one.format(2)).toEqual('1.00');
    expect(stringifiedWithoutWhole.format(0)).toEqual('0');
    expect(stringifiedWithoutWhole.format(3)).toEqual('0.500');
    expect(stringifiedWithoutWhole.format(20)).toEqual(
      '0.50000000000000000000',
    );
    expect(negativeBN.format(10)).toEqual('-123.0000000000');
    expect(negativeBN.format()).toEqual('-123');
  });

  it('should convert to JSON', () => {
    const objectToStringify = {
      name: 'eur',
      price: new FPN(99.123),
      priceBN: new BN('99123000000000000000'),
    };
    const json = JSON.stringify(objectToStringify);
    const obj = JSON.parse(json);
    expect(obj.price).toEqual(obj.priceBN);
    expect(FPN.fromWei(new BN(obj.price, 16)).format(3)).toEqual('99.123');
  });

  it("High precision float shouldn't crash", () => {
    const highPrecisionFloat = 0.0005520996027849057;
    expect(new FPN(highPrecisionFloat).format(5)).toEqual('0.00055');
  });

  it("Exponential notation shouldn't crash", () => {
    const exp = 7.514464338823816e-7;
    expect(new FPN(exp).format(7)).toEqual('0.0000007');
  });
});
