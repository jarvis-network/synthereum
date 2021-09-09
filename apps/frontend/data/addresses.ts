import { assertIsAddress as A } from '@jarvis-network/core-utils/dist/eth/address';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';
import { WETH9 } from '@uniswap/sdk-core';

export const addresses = {
  [Network.mainnet]: {
    // USDC: A('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    WBTC: A<1>('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
    WETH: A<1>(WETH9[Network.mainnet].address),
    MATIC: A<1>('0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0'),
  },
  [Network.kovan]: {
    // USDC: A('0xe22da380ee6B445bb8273C81944ADEB6E8450422'),
    WBTC: A<42>('0xd1b98b6607330172f1d991521145a22bce793277'),
    WETH: A<42>(WETH9[Network.kovan].address),
    MATIC: A<42>('0x13512979ade267ab5100878e2e0f485b568328a4'),
  },
  [Network.polygon]: {
    WBTC: A<137>('0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'),
    ETH: A<137>('0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'),
    WMATIC: A<137>('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'),
  },
} as const;
