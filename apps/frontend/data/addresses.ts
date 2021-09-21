import { assertIsAddress as A } from '@jarvis-network/core-utils/dist/eth/address';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';
import { WETH9 } from '@uniswap/sdk-core';

export const addresses = {
  [Network.mainnet]: {
    // USDC: A('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    WBTC: A<1>('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
    WETH: A<1>(WETH9[Network.mainnet].address),
    MATIC: A<1>('0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0'),
    JRT: A<1>('0x8a9c67fee641579deba04928c4bc45f66e26343a'),
    AAVE: A<1>('0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9'),
    UMA: A<1>('0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828'),
    LINK: A<1>('0x514910771af9ca656af840dff83e8264ecf986ca'),
    QUICK: A<1>('0x6c28aef8977c9b773996d0e8376d2ee379446f2f'),
    SUSHI: A<1>('0x6b3595068778dd592e39a122f4f5a5cf09c90fe2'),
  },
  [Network.kovan]: {
    // USDC: A('0xe22da380ee6B445bb8273C81944ADEB6E8450422'),
    WBTC: A<42>('0xd1b98b6607330172f1d991521145a22bce793277'),
    WETH: A<42>(WETH9[Network.kovan].address),
    MATIC: A<42>('0x13512979ade267ab5100878e2e0f485b568328a4'),
    JRT: A<42>('0xec8fe8aa79dadca065496b791ae1c1338dfbbed1'),
    AAVE: A<42>('0xb597cd8d3217ea6477232f9217fa70837ff667af'),
    UMA: A<42>('0x7fdb81b0b8a010dd4ffc57c3fecbf145ba8bd947'),
    LINK: A<42>('0xad5ce863ae3e4e9394ab43d4ba0d80f419f61789'),
    QUICK: A<42>('0x61e4cae3da7fd189e52a4879c7b8067d7c2cc0fa'),
    SUSHI: A<42>('0x738dc6380157429e957d223e6333dc385c85fec7'),
  },
  [Network.polygon]: {
    WBTC: A<137>('0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'),
    ETH: A<137>('0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'),
    WMATIC: A<137>('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'),
    JRT: A<137>('0x596ebe76e2db4470966ea395b0d063ac6197a8c5'),
    AAVE: A<137>('0xd6df932a45c0f255f85145f286ea0b292b21c90b'),
    UMA: A<137>('0x3066818837c5e6ed6601bd5a91b0762877a6b731'),
    LINK: A<137>('0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39'),
    QUICK: A<137>('0x831753dd7087cac61ab5644b308642cc1c33dc13'),
    SUSHI: A<137>('0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a'),
  },
} as const;
