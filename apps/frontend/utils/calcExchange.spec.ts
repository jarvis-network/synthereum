import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { Asset } from '@/data/assets';

import { calcExchange } from './calcExchange';

describe('calcExchange', () => {
  const fee = new FPN(0.002);
  const USDC: Asset = {
    name: 'USDC',
    symbol: 'USDC',
    pair: null,
    price: new FPN(1),
    decimals: 1,
    type: 'forex',
  };

  const jEUR: Asset = {
    name: 'jEUR',
    symbol: 'jEUR',
    pair: null,
    price: new FPN(2),
    decimals: 1,
    type: 'forex',
  };

  const jCHF: Asset = {
    name: 'jCHF',
    symbol: 'jCHF',
    pair: null,
    price: new FPN(4),
    decimals: 1,
    type: 'forex',
  };

  test('mint jEUR with gross USDC', () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'pay',
      assetPay: USDC,
      assetReceive: jEUR,
      pay: '100',
      receive: '',
      fee,
    });

    expect(payValue?.format(18)).toBe('100.000000000000000000'); // UI determined from stringified value
    expect(grossCollateral).toBe(payValue);
    expect(netCollateral?.format(18)).toBe('99.800399201596806387');
    expect(transactionCollateral).toBe(netCollateral); // use net for SC
    expect(receiveValue?.format(18)).toBe('49.900199600798403193'); // actual output
  });

  test('mint jEUR with net jEUR', () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'receive',
      assetPay: USDC,
      assetReceive: jEUR,
      pay: '',
      receive: '50',
      fee,
    });

    expect(receiveValue?.format(18)).toBe('50.000000000000000000'); // UI determined from stringified value
    expect(netCollateral?.format(18)).toBe('100.000000000000000000');
    expect(transactionCollateral).toBe(netCollateral); // use net for SC
    expect(grossCollateral?.format(18)).toBe('100.200000000000000000');
    expect(payValue).toBe(grossCollateral); // actual output
  });

  test('redeem jEUR with gross USDC', () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'receive',
      assetPay: jEUR,
      assetReceive: USDC,
      pay: '',
      receive: '100',
      fee,
    });

    expect(receiveValue?.format(18)).toBe('100.000000000000000000'); // UI determined from stringified value
    expect(netCollateral).toBe(receiveValue);
    expect(grossCollateral?.format(18)).toBe('100.200400801603206412');
    expect(transactionCollateral).toBe(grossCollateral); // use gross for SC
    expect(payValue?.format(18)).toBe('50.100200400801603206'); // actual output
  });

  test('redeem jEUR with net jEUR', () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'pay',
      assetPay: jEUR,
      assetReceive: USDC,
      pay: '50',
      receive: '',
      fee,
    });

    expect(payValue?.format(18)).toBe('50.000000000000000000'); // UI determined from stringified value
    expect(grossCollateral?.format(18)).toBe('100.000000000000000000');
    expect(transactionCollateral).toBe(grossCollateral); // use gross for SC
    expect(netCollateral?.format(18)).toBe('99.800000000000000000');
    expect(receiveValue).toBe(netCollateral); // actual output
  });

  test('Exchange jEUR->jCHF with gross jEUR', () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'pay',
      assetPay: jEUR,
      assetReceive: jCHF,
      pay: '50',
      receive: '',
      fee,
    });

    expect(payValue?.format(18)).toBe('50.000000000000000000'); // UI determined from stringified value but also value for SC
    expect(grossCollateral?.format(18)).toBe('100.000000000000000000');
    expect(transactionCollateral).toBe(grossCollateral); // use gross for SC
    expect(netCollateral?.format(18)).toBe('99.800000000000000000');
    expect(receiveValue?.format(18)).toBe('24.950000000000000000'); // actual output
  });

  test('Exchange jEUR->jCHF with gross jCHF', () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'receive',
      assetPay: jEUR,
      assetReceive: jCHF,
      pay: '',
      receive: '25',
      fee,
    });

    expect(receiveValue?.format(18)).toBe('25.000000000000000000'); // UI determined from stringified value but also SC value
    expect(netCollateral?.format(18)).toBe('100.000000000000000000');
    expect(grossCollateral?.format(18)).toBe('100.200400801603206412');
    expect(transactionCollateral).toBe(grossCollateral); // use gross for SC
    expect(payValue?.format(18)).toBe('50.100200400801603206'); // actual output
  });

  test("Don't allow safe asset twice", () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'receive',
      assetPay: jEUR,
      assetReceive: jEUR,
      pay: '',
      receive: '25',
      fee,
    });

    expect(payValue).toBe(null);
    expect(receiveValue).toBe(null);
    expect(netCollateral).toBe(null);
    expect(grossCollateral).toBe(null);
    expect(transactionCollateral).toBe(null);
  });

  test("Don't allow pay asset without a price", () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'receive',
      assetPay: { ...jEUR, price: null },
      assetReceive: jCHF,
      pay: '',
      receive: '25',
      fee,
    });

    expect(payValue).toBe(null);
    expect(receiveValue).toBe(null);
    expect(netCollateral).toBe(null);
    expect(grossCollateral).toBe(null);
    expect(transactionCollateral).toBe(null);
  });

  test("Don't allow receive asset without a price", () => {
    const {
      payValue,
      receiveValue,
      netCollateral,
      grossCollateral,
      transactionCollateral,
    } = calcExchange({
      base: 'receive',
      assetPay: jEUR,
      assetReceive: { ...jCHF, price: null },
      pay: '',
      receive: '25',
      fee,
    });

    expect(payValue).toBe(null);
    expect(receiveValue).toBe(null);
    expect(netCollateral).toBe(null);
    expect(grossCollateral).toBe(null);
    expect(transactionCollateral).toBe(null);
  });
});
