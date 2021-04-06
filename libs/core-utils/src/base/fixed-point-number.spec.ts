import assert from 'assert';
import BN from 'bn.js';
import { FPN } from '../../src/base/fixed-point-number';

const one = new FPN(1);
const twelve = new FPN(12);
const almostPI = new FPN(3.14);
const stringifiedFloat = new FPN('1.005');
const strinifiedWithoutFraction = new FPN('5.');
const strigifiedWithoutWhole = new FPN('.5');
const justDot = new FPN('.');
const empty = new FPN('0');
const onetwothreefour = new FPN(new BN(1234));
const wei69 = FPN.fromWei(new BN('69000000000000000000'));
const negativeFiveAndHalf = new FPN(-5.5);
const negativeWei = FPN.fromWei('-11000000000000000000');
const negativeBN = new FPN(new BN('-123'));
const fromHex = FPN.fromWei(new BN('55f9ba352e70b8000', 16));

assert.strictEqual(one.toString(10), '1000000000000000000');
assert.strictEqual(twelve.toString(10), '12000000000000000000');
assert.strictEqual(almostPI.toString(10), '3140000000000000000');
assert.strictEqual(stringifiedFloat.toString(10), '1005000000000000000');
assert.strictEqual(
  strinifiedWithoutFraction.toString(10),
  '5000000000000000000',
);
assert.strictEqual(strigifiedWithoutWhole.toString(10), '500000000000000000');
assert.strictEqual(justDot.toString(10), '0');
assert.strictEqual(empty.toString(10), '0');
assert.strictEqual(onetwothreefour.toString(10), '1234000000000000000000');
assert.strictEqual(wei69.toString(10), '69000000000000000000');
assert.strictEqual(negativeFiveAndHalf.toString(10), '-5500000000000000000');
assert.strictEqual(negativeWei.toString(10), '-11000000000000000000');
assert.strictEqual(negativeBN.toString(10), '-123000000000000000000');
assert.strictEqual(fromHex.toString(10), '99123000000000000000');

// Maths
assert.strictEqual(one.add(one).toString(10), '2000000000000000000');
assert.strictEqual(one.add(new FPN(1)).toString(10), '2000000000000000000');
assert.strictEqual(one.sub(one).toString(10), '0');
assert.strictEqual(one.sub(one).sub(one).toString(10), '-1000000000000000000');
assert.strictEqual(wei69.div(new FPN(3)).toString(10), '23000000000000000000');
assert.strictEqual(
  new FPN(98).div(new FPN(99)).toString(10),
  '989898989898989898',
);
assert.strictEqual(wei69.mul(new FPN(3)).toString(10), '207000000000000000000');

// Formatting
assert.strictEqual(
  new FPN(98).div(new FPN(99)).format(),
  '0.989898989898989898',
);
assert.strictEqual(one.format(2), '1.00');
assert.strictEqual(strigifiedWithoutWhole.format(0), '0');
assert.strictEqual(strigifiedWithoutWhole.format(3), '0.500');
assert.strictEqual(strigifiedWithoutWhole.format(20), '0.50000000000000000000');
assert.strictEqual(negativeBN.format(10), '-123.0000000000');
assert.strictEqual(negativeBN.format(), '-123');

// JSON
const objectToStringify = {
  name: 'eur',
  price: new FPN(99.123),
  pricebn: new BN('99123000000000000000'),
};
const json = JSON.stringify(objectToStringify);
const obj = JSON.parse(json);
assert.strictEqual(obj.price, obj.pricebn);
assert.strictEqual(FPN.fromWei(new BN(obj.price, 16)).format(3), '99.123');

// High precision float shouldn't crash
const highPrecisionFloat = 0.0005520996027849057;
assert.strictEqual(new FPN(highPrecisionFloat).format(5), '0.00055');

// Expotential notation shouldn't crash
const exp = 7.514464338823816e-7;
assert.strictEqual(new FPN(exp).format(7), '0.0000007');
