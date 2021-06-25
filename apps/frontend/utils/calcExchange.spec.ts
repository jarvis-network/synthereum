import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { Asset } from '@/data/assets';

import { calcExchange } from './calcExchange';

describe('calcExchange', () => {
  const feePercentage = new FPN(0.002);
  const USDC: Asset = {
    name: 'USDC',
    symbol: 'USDC',
    pair: null,
    icon: null,
    price: new FPN(1),
    decimals: 6,
    type: 'forex',
  };

  const jEUR: Asset = {
    name: 'jEUR',
    symbol: 'jEUR',
    pair: null,
    icon: null,
    price: new FPN('1.19037'),
    decimals: 18,
    type: 'forex',
  };

  const jCHF: Asset = {
    name: 'jCHF',
    symbol: 'jCHF',
    pair: null,
    icon: null,
    price: new FPN('1.0771633'),
    decimals: 18,
    type: 'forex',
  };

  // https://kovan.etherscan.io/tx/0x3e2d4b63ae76204112378bd9cf0029c1758457ab480a76dd18870ab7da187b24
  test('mint jEUR with 10 USDC', () => {
    const { payValue, receiveValue, fee } = calcExchange({
      base: 'pay',
      assetPay: USDC,
      assetReceive: jEUR,
      pay: '10',
      receive: '',
      feePercentage,
      collateralAsset: USDC,
    })!;

    expect(payValue.format(USDC.decimals)).toBe('10.000000');
    expect(receiveValue.format(jEUR.decimals)).toBe('8.383947848148054806');
    expect(fee.format(USDC.decimals)).toBe('0.020000');
  });

  test('mint 8.383947848148054806 jEUR with 10 USDC', () => {
    const { payValue, receiveValue, fee } = calcExchange({
      base: 'receive',
      assetPay: USDC,
      assetReceive: jEUR,
      pay: '',
      receive: '8.383947848148054806',
      feePercentage,
      collateralAsset: USDC,
    })!;

    expect(payValue.format(USDC.decimals)).toBe('10.000000');
    expect(receiveValue.format(jEUR.decimals)).toBe('8.383947848148054806');
    expect(fee.format(USDC.decimals)).toBe('0.020000');
  });

  // https://kovan.etherscan.io/tx/0x6a5d71f18d879ef718596e87ef81befa019c2a6b832eba5dbff6e90342ba6d5f
  test('mint 10 jEUR', () => {
    const { payValue, receiveValue, fee } = calcExchange({
      base: 'receive',
      assetPay: USDC,
      assetReceive: jEUR,
      pay: '',
      receive: '10',
      feePercentage,
      collateralAsset: USDC,
    })!;

    expect(receiveValue.format(jEUR.decimals)).toBe('10.000000000000000000');
    expect(payValue.format(USDC.decimals)).toBe('11.927557');
    // expect(fee.format(USDC.decimals)).toBe('0.023807');
    expect(fee.format(USDC.decimals)).toBe('0.023855');
  });

  // https://kovan.etherscan.io/tx/0x63345c36e520e2a9dd9721966b8418659450be0e75c44cd163a7a7e43402e634
  test('redeem 10 USDC for jEUR', () => {
    const { payValue, receiveValue, fee } = calcExchange({
      base: 'receive',
      assetPay: jEUR,
      assetReceive: USDC,
      pay: '',
      receive: '10',
      feePercentage,
      collateralAsset: USDC,
    })!;

    expect(receiveValue.format(USDC.decimals)).toBe('10.000000');
    // expect(payValue.format(jEUR.decimals)).toBe('8.417584515873485253');
    expect(payValue.format(jEUR.decimals)).toBe('8.417584448532809127');
    expect(fee.format(USDC.decimals)).toBe('0.020040');
  });

  // https://kovan.etherscan.io/tx/0xaf492e8dcc2e03c8eaf310bb5ed9ac0b0925037c7461ad94eb5a176c2e4090f9
  test('redeem USDC for 10 jEUR', () => {
    const { payValue, receiveValue, fee } = calcExchange({
      base: 'pay',
      assetPay: jEUR,
      assetReceive: USDC,
      pay: '10',
      receive: '',
      feePercentage,
      collateralAsset: USDC,
    })!;

    expect(payValue.format(jEUR.decimals)).toBe('10.000000000000000000');
    expect(receiveValue.format(USDC.decimals)).toBe('11.879893');
    expect(fee.format(USDC.decimals)).toBe('0.023807');
  });

  // https://kovan.etherscan.io/tx/0x42ef72388e691a0721b9e5ae3484ea5a12c9191e63039dc610f2f4dee2f9e4f9
  test('Exchange 10 jEUR for jCHF', () => {
    const { payValue, receiveValue, fee } = calcExchange({
      base: 'pay',
      assetPay: jEUR,
      assetReceive: jCHF,
      pay: '10',
      receive: '',
      feePercentage,
      collateralAsset: USDC,
    })!;

    expect(payValue.format(jEUR.decimals)).toBe('10.000000000000000000');
    expect(receiveValue.format(jCHF.decimals)).toBe('11.028869067484939377');
    expect(fee.format(USDC.decimals)).toBe('0.023807');
  });

  // https://kovan.etherscan.io/tx/0x0f8c4b9276dd7bab1a84dc4f36e7af712c931ddc75fce142c9ea6ed6fa098b31
  test('Exchange jEUR for 10 jCHF', () => {
    const { payValue, receiveValue, fee } = calcExchange({
      base: 'receive',
      assetPay: jEUR,
      assetReceive: jCHF,
      pay: '',
      receive: '10',
      feePercentage,
      collateralAsset: USDC,
    })!;

    expect(receiveValue.format(jCHF.decimals)).toBe('10.000000000000000000');
    // expect(payValue.format(jEUR.decimals)).toBe('9.067118626981526753');
    expect(payValue.format(jEUR.decimals)).toBe('9.067113586531918648');
    // expect(fee.format(USDC.decimals)).toBe('0.021543');
    expect(fee.format(USDC.decimals)).toBe('0.021586');
  });

  // https://kovan.etherscan.io/tx/0xff4f7fe08db1243ddc519330165b9c20e6f4ac923d9c9f4181f16b5ad1a7c35d
  test('Exchange 1 jCHF for jEUR', () => {
    /* eslint-disable camelcase */
    const jEUR_73786976294838217048: Asset = {
      name: 'jEUR',
      symbol: 'jEUR',
      pair: null,
      icon: null,
      price: new FPN('1.18356000'),
      decimals: 18,
      type: 'forex',
    };

    const jCHF_36893488147419113831: Asset = {
      name: 'jCHF',
      symbol: 'jCHF',
      pair: null,
      icon: null,
      price: new FPN('1.09008620'),
      decimals: 18,
      type: 'forex',
    };

    const { payValue, receiveValue, fee } = calcExchange({
      base: 'pay',
      assetPay: jCHF_36893488147419113831,
      assetReceive: jEUR_73786976294838217048,
      pay: '1',
      receive: '',
      feePercentage,
      collateralAsset: USDC,
    })!;
    expect(payValue.format(jCHF_36893488147419113831.decimals)).toBe(
      '1.000000000000000000',
    );
    expect(receiveValue.format(jEUR_73786976294838217048.decimals)).toBe(
      '0.919181114603399912',
    );
    expect(fee.format(USDC.decimals)).toBe('0.002180');
    /* eslint-enable camelcase */
  });

  test("Don't allow safe asset twice", () => {
    const result = calcExchange({
      base: 'receive',
      assetPay: jEUR,
      assetReceive: jEUR,
      pay: '',
      receive: '25',
      feePercentage,
      collateralAsset: USDC,
    });

    expect(result).toBe(null);
  });

  test("Don't allow pay asset without a price", () => {
    const result = calcExchange({
      base: 'receive',
      assetPay: { ...jEUR, price: null },
      assetReceive: jCHF,
      pay: '',
      receive: '25',
      feePercentage,
      collateralAsset: USDC,
    });

    expect(result).toBe(null);
  });

  test("Don't allow receive asset without a price", () => {
    const result = calcExchange({
      base: 'receive',
      assetPay: jEUR,
      assetReceive: { ...jCHF, price: null },
      pay: '',
      receive: '25',
      feePercentage,
      collateralAsset: USDC,
    });

    expect(result).toBe(null);
  });
});
