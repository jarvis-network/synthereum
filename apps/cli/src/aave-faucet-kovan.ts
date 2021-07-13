import {
  assert,
  assertNotNull,
} from '@jarvis-network/core-utils/dist/base/asserts';
import { assertIsAddress as A } from '@jarvis-network/core-utils/dist/eth/address';
import { log } from '@jarvis-network/core-utils/dist/logging';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { setPrivateKey_DevelopmentOnly } from '@jarvis-network/core-utils/dist/eth/web3-instance';

import { buildCli } from './common/cli-config';
import { createCliApp } from './common/create-cli-app';

const FAUCET_CONTRACT_ADDRESS = A('0x600103d518cc5e8f3319d532eb4e5c268d32e604');

const MINT_METHOD_ID = 0x40c10f19;

const aaveTokens = {
  USDC: {
    address: A('0xe22da380ee6B445bb8273C81944ADEB6E8450422'),
    decimals: 6,
  },
  USDT: {
    address: A('0x13512979ade267ab5100878e2e0f485b568328a4'),
    decimals: 6,
  },
  DAI: {
    address: A('0xff795577d9ac8bd7d90ee22b6c1703490b6512fd'),
    decimals: 18,
  },
  TUSD: {
    address: A('0x016750ac630f711882812f24dba6c95b9d35856d'),
    decimals: 18,
  },
  sUSD: {
    address: A('0x99b267b9d96616f906d53c26decf3c5672401282'),
    decimals: 18,
  },
  BUSD: {
    address: A('0x4c6e1efc12fdfd568186b7baec0a43fffb4bcccf'),
    decimals: 18,
  },
  WBTC: {
    address: A('0xd1b98b6607330172f1d991521145a22bce793277'),
    decimals: 8,
  },
  AAVE: {
    address: A('0xb597cd8d3217ea6477232f9217fa70837ff667af'),
    decimals: 18,
  },
  UNI: {
    address: A('0x075a36ba8846c6b6f53644fdd3bf17e5151789dc'),
    decimals: 18,
  },
  YFI: {
    address: A('0xb7c325266ec274feb1354021d27fa3e3379d840d'),
    decimals: 18,
  },
  BAT: {
    address: A('0x2d12186fbb9f9a8c28b3ffdd4c42920f8539d738'),
    decimals: 18,
  },
  REN: {
    address: A('0x5eebf65a6746eed38042353ba84c8e37ed58ac6f'),
    decimals: 18,
  },
  ENJ: {
    address: A('0xc64f90cd7b564d3ab580eb20a102a8238e218be2'),
    decimals: 18,
  },
  KNC: {
    address: A('0x3f80c39c0b96a0945f9f0e9f55d8a8891c5671a8'),
    decimals: 18,
  },
  LINK: {
    address: A('0xad5ce863ae3e4e9394ab43d4ba0d80f419f61789'),
    decimals: 18,
  },
  MANA: {
    address: A('0x738dc6380157429e957d223e6333dc385c85fec7'),
    decimals: 18,
  },
  MKR: {
    address: A('0x61e4cae3da7fd189e52a4879c7b8067d7c2cc0fa'),
    decimals: 18,
  },
  SNX: {
    address: A('0x7fdb81b0b8a010dd4ffc57c3fecbf145ba8bd947'),
    decimals: 18,
  },
  ZRX: {
    address: A('0xd0d76886cf8d952ca26177eb7cfdf83bad08c00c'),
    decimals: 18,
  },
} as const;

/**
 * Sends a desired amount of tokens to your address (Kovan only)
 */
createCliApp(
  buildCli(__filename)
    .option('token', {
      type: 'string',
      required: true,
      coerce: token => {
        const supportedTokens = Object.keys(aaveTokens);
        assert(
          supportedTokens.includes(token as string),
          `Token not supported. Supported tokens are ${supportedTokens.join(
            ', ',
          )}`,
        );

        return token as keyof typeof aaveTokens;
      },
    })
    .option('amount', {
      type: 'number',
      default: 100_000,
      coerce: amount => {
        assert(amount > 0, 'amount is not bigger than 0');
        return amount;
      },
    }),
  async ({ web3, argv: { token = '', amount } }) => {
    if (['AAVE', 'YFI'].includes(token) && amount !== 1) {
      amount = 1;
      log(
        `${token} supports minting only 1 at a time (amount argument disregarded)`,
      );
    }

    setPrivateKey_DevelopmentOnly(web3, assertNotNull(process.env.PRIVATE_KEY));
    const address = A(web3.defaultAccount);
    log('Private key set - using', { address });

    const tokenInfo = aaveTokens[token as keyof typeof aaveTokens];
    const amountHex = new FPN(amount, true)
      .increasePrecision(tokenInfo.decimals)
      .toString('hex');
    const data = `0x${MINT_METHOD_ID.toString(
      16,
    )}${tokenInfo.address
      .toLowerCase()
      .slice(2)
      .padStart(64, '0')}${amountHex.padStart(64, '0')}`;

    const config = {
      data,
      to: FAUCET_CONTRACT_ADDRESS,
      from: address,
    };

    const gas = await web3.eth.estimateGas(config);

    const tx = await web3.eth.sendTransaction({ ...config, gas });

    log(
      `\nSuccessfully received ${amount} ${token} at address ${web3.eth.defaultAccount}\nTransaction hash: ${tx.transactionHash}\nEtherscan link: https://kovan.etherscan.io/tx/${tx.transactionHash}`,
    );
  },
);
