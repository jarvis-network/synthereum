import {
  Amount,
  weiFromBN,
  weiFromFPN,
} from '@jarvis-network/core-utils/dist/base/big-number';
import { useExchangeContext } from '@/utils/ExchangeContext';
import { SyntheticSymbol } from '@jarvis-network/synthereum-ts/dist/config';
import { PRIMARY_STABLE_COIN } from '@/data/assets';
import {
  useBehaviorSubject,
  useCoreObservables,
  useTransactionSpeed,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { SynthereumTransactionType } from '@/data/transactions';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';
import { AbiItem } from 'web3-utils';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import {
  FullTxOptions,
  sendTx,
} from '@jarvis-network/core-utils/dist/eth/contracts/send-tx';
import {
  getTokenAllowance,
  setMaxTokenAllowance,
} from '@jarvis-network/core-utils/dist/eth/contracts/erc20';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import {
  Network,
  NetworkName,
} from '@jarvis-network/core-utils/dist/eth/networks';
import { ERC20_Abi } from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import { getContract } from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import { TokenInfo } from '@jarvis-network/core-utils/dist/eth/contracts/types';
import { useMemo } from 'react';
import BN from 'bn.js';

const noop = () => undefined;

const atomicSwapAbi = [
  {
    inputs: [
      {
        internalType: 'contract ISynthereumFinder',
        name: '_synthereumFinder',
        type: 'address',
      },
      {
        internalType: 'contract IUniswapV2Router02',
        name: '_uniswapRouter',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'inpuToken',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'inputAmount',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'outputToken',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'outputAmount',
        type: 'uint256',
      },
    ],
    name: 'Swap',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountTokenOut', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenSwapPath', type: 'address[]' },
      {
        internalType: 'contract ISynthereumPoolOnChainPriceFeed',
        name: 'synthereumPool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IDerivative',
            name: 'derivative',
            type: 'address',
          },
          { internalType: 'uint256', name: 'numTokens', type: 'uint256' },
          { internalType: 'uint256', name: 'minCollateral', type: 'uint256' },
          { internalType: 'uint256', name: 'feePercentage', type: 'uint256' },
          { internalType: 'uint256', name: 'expiration', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        internalType: 'struct ISynthereumPoolOnChainPriceFeed.RedeemParams',
        name: 'redeemParams',
        type: 'tuple',
      },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'redeemAndSwapExactTokens',
    outputs: [
      { internalType: 'uint256', name: 'collateralRedeemed', type: 'uint256' },
      { internalType: 'contract IERC20', name: 'outputToken', type: 'address' },
      { internalType: 'uint256', name: 'outputTokenAmount', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountTokenOut', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenSwapPath', type: 'address[]' },
      {
        internalType: 'contract ISynthereumPoolOnChainPriceFeed',
        name: 'synthereumPool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IDerivative',
            name: 'derivative',
            type: 'address',
          },
          { internalType: 'uint256', name: 'numTokens', type: 'uint256' },
          { internalType: 'uint256', name: 'minCollateral', type: 'uint256' },
          { internalType: 'uint256', name: 'feePercentage', type: 'uint256' },
          { internalType: 'uint256', name: 'expiration', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        internalType: 'struct ISynthereumPoolOnChainPriceFeed.RedeemParams',
        name: 'redeemParams',
        type: 'tuple',
      },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'redeemAndSwapExactTokensForETH',
    outputs: [
      { internalType: 'uint256', name: 'collateralRedeemed', type: 'uint256' },
      { internalType: 'contract IERC20', name: 'outputToken', type: 'address' },
      { internalType: 'uint256', name: 'outputTokenAmount', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountTokenOut', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenSwapPath', type: 'address[]' },
      {
        internalType: 'contract ISynthereumPoolOnChainPriceFeed',
        name: 'synthereumPool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IDerivative',
            name: 'derivative',
            type: 'address',
          },
          { internalType: 'uint256', name: 'numTokens', type: 'uint256' },
          { internalType: 'uint256', name: 'minCollateral', type: 'uint256' },
          { internalType: 'uint256', name: 'feePercentage', type: 'uint256' },
          { internalType: 'uint256', name: 'expiration', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        internalType: 'struct ISynthereumPoolOnChainPriceFeed.RedeemParams',
        name: 'redeemParams',
        type: 'tuple',
      },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'redeemAndSwapTokensForExact',
    outputs: [
      { internalType: 'uint256', name: 'collateralRedeemed', type: 'uint256' },
      { internalType: 'contract IERC20', name: 'outputToken', type: 'address' },
      { internalType: 'uint256', name: 'outputTokenAmount', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountTokenOut', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenSwapPath', type: 'address[]' },
      {
        internalType: 'contract ISynthereumPoolOnChainPriceFeed',
        name: 'synthereumPool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IDerivative',
            name: 'derivative',
            type: 'address',
          },
          { internalType: 'uint256', name: 'numTokens', type: 'uint256' },
          { internalType: 'uint256', name: 'minCollateral', type: 'uint256' },
          { internalType: 'uint256', name: 'feePercentage', type: 'uint256' },
          { internalType: 'uint256', name: 'expiration', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        internalType: 'struct ISynthereumPoolOnChainPriceFeed.RedeemParams',
        name: 'redeemParams',
        type: 'tuple',
      },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'redeemAndSwapTokensForExactETH',
    outputs: [
      { internalType: 'uint256', name: 'collateralRedeemed', type: 'uint256' },
      { internalType: 'contract IERC20', name: 'outputToken', type: 'address' },
      { internalType: 'uint256', name: 'outputTokenAmount', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'collateralAmountOut', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenSwapPath', type: 'address[]' },
      {
        internalType: 'contract ISynthereumPoolOnChainPriceFeed',
        name: 'synthereumPool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IDerivative',
            name: 'derivative',
            type: 'address',
          },
          { internalType: 'uint256', name: 'minNumTokens', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'collateralAmount',
            type: 'uint256',
          },
          { internalType: 'uint256', name: 'feePercentage', type: 'uint256' },
          { internalType: 'uint256', name: 'expiration', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        internalType: 'struct ISynthereumPoolOnChainPriceFeed.MintParams',
        name: 'mintParams',
        type: 'tuple',
      },
    ],
    name: 'swapETHForExactAndMint',
    outputs: [
      { internalType: 'uint256', name: 'collateralOut', type: 'uint256' },
      { internalType: 'contract IERC20', name: 'synthToken', type: 'address' },
      {
        internalType: 'uint256',
        name: 'syntheticTokensMinted',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'collateralAmountOut', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenSwapPath', type: 'address[]' },
      {
        internalType: 'contract ISynthereumPoolOnChainPriceFeed',
        name: 'synthereumPool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IDerivative',
            name: 'derivative',
            type: 'address',
          },
          { internalType: 'uint256', name: 'minNumTokens', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'collateralAmount',
            type: 'uint256',
          },
          { internalType: 'uint256', name: 'feePercentage', type: 'uint256' },
          { internalType: 'uint256', name: 'expiration', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        internalType: 'struct ISynthereumPoolOnChainPriceFeed.MintParams',
        name: 'mintParams',
        type: 'tuple',
      },
    ],
    name: 'swapExactETHAndMint',
    outputs: [
      { internalType: 'uint256', name: 'collateralOut', type: 'uint256' },
      { internalType: 'contract IERC20', name: 'synthToken', type: 'address' },
      {
        internalType: 'uint256',
        name: 'syntheticTokensMinted',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenAmountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'collateralAmountOut', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenSwapPath', type: 'address[]' },
      {
        internalType: 'contract ISynthereumPoolOnChainPriceFeed',
        name: 'synthereumPool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IDerivative',
            name: 'derivative',
            type: 'address',
          },
          { internalType: 'uint256', name: 'minNumTokens', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'collateralAmount',
            type: 'uint256',
          },
          { internalType: 'uint256', name: 'feePercentage', type: 'uint256' },
          { internalType: 'uint256', name: 'expiration', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        internalType: 'struct ISynthereumPoolOnChainPriceFeed.MintParams',
        name: 'mintParams',
        type: 'tuple',
      },
    ],
    name: 'swapExactTokensAndMint',
    outputs: [
      { internalType: 'uint256', name: 'collateralOut', type: 'uint256' },
      { internalType: 'contract IERC20', name: 'synthToken', type: 'address' },
      {
        internalType: 'uint256',
        name: 'syntheticTokensMinted',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenAmountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'collateralAmountOut', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenSwapPath', type: 'address[]' },
      {
        internalType: 'contract ISynthereumPoolOnChainPriceFeed',
        name: 'synthereumPool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IDerivative',
            name: 'derivative',
            type: 'address',
          },
          { internalType: 'uint256', name: 'minNumTokens', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'collateralAmount',
            type: 'uint256',
          },
          { internalType: 'uint256', name: 'feePercentage', type: 'uint256' },
          { internalType: 'uint256', name: 'expiration', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        internalType: 'struct ISynthereumPoolOnChainPriceFeed.MintParams',
        name: 'mintParams',
        type: 'tuple',
      },
    ],
    name: 'swapTokensForExactAndMint',
    outputs: [
      { internalType: 'uint256', name: 'collateralOut', type: 'uint256' },
      { internalType: 'contract IERC20', name: 'synthToken', type: 'address' },
      {
        internalType: 'uint256',
        name: 'syntheticTokensMinted',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'synthereumFinder',
    outputs: [
      { internalType: 'contract ISynthereumFinder', name: '', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'uniswapRouter',
    outputs: [
      {
        internalType: 'contract IUniswapV2Router02',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const atomicSwapAddressKovan = '0xBD8d727F9Bb62Ceee65CA51487F6fC7381adca7e';
const atomicSwapAddressMainnet = '0x9A27329Fc40E32C796E08D98De73C23eD7C0910e';
const atomicSwapAddressPolygon = '0xb711f3A71c00D92EF862A4aF2f584635DfE318b8';

async function ensureSufficientAllowanceFor<Net extends NetworkName>({
  tokenInfo,
  account,
  spender,
  necessaryAllowance,
  txOptions,
}: {
  tokenInfo: TokenInfo<Net>;
  account: AddressOn<Net>;
  spender: AddressOn<Net>;
  necessaryAllowance: Amount;
  txOptions: FullTxOptions<Net>;
}) {
  const allowance = await getTokenAllowance(tokenInfo, account, spender);
  if (allowance.lt(necessaryAllowance)) {
    return (await sendTx(setMaxTokenAllowance(tokenInfo, spender), txOptions))
      .promiEvent;
  }
  return true;
}

const zero = weiFromBN(new BN(0));
const oneGwei = 1000 * 1000 * 1000;
const estimationIsNotSupportedRejection = handledPromiseReject(
  'Estimation is not supported',
);
const doNotUseWhenEstimatingRejection = handledPromiseReject(
  'Do not use this promise when estimating',
);
const doNotUseWhenNotEstimatingRejection = handledPromiseReject(
  'Do not use this promise when not estimating',
);
export const useSwap = () => {
  const { library: web3, account: address } = useWeb3();
  const agent = useBehaviorSubject(useCoreObservables().realmAgent$);
  const { deadline, transactionSpeed, gasLimit } = useReduxSelector(state => ({
    deadline: state.exchange.deadline,
    transactionSpeed: state.exchange.transactionSpeed,
    gasLimit: state.exchange.gasLimit,
  }));
  const {
    paySymbol,
    payValue,
    receiveSymbol,
    receiveValue,
    shouldRedeemAndSwap,
    shouldSwapAndMint,
    path,
    assetPay,
    assetReceive,
    base,
    inputAmount,
    outputAmount,
    minimumReceiveValue,
    maximumSentValue,
    minimumSynthReceiveValue,
    maximumSynthSentValue,
  } = useExchangeContext();
  const transactionSpeedContext = useTransactionSpeed();
  const gasPrice = transactionSpeedContext
    ? transactionSpeedContext[transactionSpeed] * oneGwei
    : undefined;

  return useMemo(() => {
    if (!agent || paySymbol === receiveSymbol) {
      // symbols should never be the same, but just in case..
      return null;
    }

    if (shouldSwapAndMint) {
      return (estimate?: FPN | null) => {
        const w3 = assertNotNull(web3);
        const contract = new w3.eth.Contract(
          atomicSwapAbi as AbiItem[],
          agent.realm.netId === Network.polygon
            ? atomicSwapAddressPolygon
            : agent.realm.netId === Network.kovan
            ? atomicSwapAddressKovan
            : atomicSwapAddressMainnet,
        );

        const isBasePay = base === 'pay';

        const tokenAmountIn = (estimate || payValue!)
          .format(assetPay!.decimals)
          .replace('.', '');
        const tokenSwapPath = path!.map(token => token.address);
        const pool = assertNotNull(agent.activePools[receiveSymbol as 'jEUR']);
        const synthereumPool = pool.address;
        const mintParams = {
          derivative: pool.derivative.address,
          minNumTokens: estimate
            ? 0
            : isBasePay
            ? minimumSynthReceiveValue!
                .format(pool.syntheticToken.decimals)
                .replace('.', '')
            : receiveValue!
                .format(pool.syntheticToken.decimals)
                .replace('.', ''),
          collateralAmount: 0,
          feePercentage: `0x${new FPN(0.002).toString('hex')}`,
          expiration: getExpiration(deadline),
          recipient: address,
        };

        const allowancePromise = assetPay!.native
          ? Promise.resolve(true)
          : ensureSufficientAllowanceFor({
              tokenInfo: {
                address: tokenSwapPath[0] as AddressOn<NetworkName>,
                symbol: assetPay!.symbol,
                decimals: assetPay!.decimals,
                instance: getContract(
                  w3 as any,
                  ERC20_Abi,
                  tokenSwapPath[0] as AddressOn<NetworkName>,
                ).instance,
              },
              account: address! as any,
              spender: (agent.realm.netId === Network.polygon
                ? atomicSwapAddressPolygon
                : agent.realm.netId === Network.kovan
                ? atomicSwapAddressKovan
                : atomicSwapAddressMainnet) as AddressOn<NetworkName>,
              necessaryAllowance: payValue!.bn as Amount,
              txOptions: { web3: w3 as any, from: address! as any, gasPrice },
            });

        const amountIn =
          estimate?.format(18).replace('.', '') ||
          (isBasePay
            ? tokenAmountIn
            : maximumSentValue!.format(assetPay!.decimals).replace('.', ''));

        const amountOut = estimate
          ? 0
          : isBasePay
          ? minimumReceiveValue!
              .format(pool.collateralToken.decimals)
              .replace('.', '')
          : outputAmount;

        const sendTxArgs =
          estimate || assetPay!.native
            ? ([
                (estimate || isBasePay
                  ? contract.methods.swapExactETHAndMint
                  : contract.methods.swapETHForExactAndMint)(
                  estimate ? 0 : amountOut,
                  tokenSwapPath,
                  synthereumPool,
                  mintParams,
                ),
                {
                  printInfo: { log: console.log },
                  web3: w3 as any,
                  from: address as any,
                  value: amountIn,
                  gasPrice,
                  gasLimit,
                },
              ] as const)
            : ([
                (isBasePay
                  ? contract.methods.swapExactTokensAndMint
                  : contract.methods.swapTokensForExactAndMint)(
                  amountIn,
                  amountOut,
                  tokenSwapPath,
                  synthereumPool,
                  mintParams,
                ),
                {
                  printInfo: { log: console.log },
                  web3: w3 as any,
                  from: address as any,
                  gasPrice,
                  gasLimit,
                },
              ] as const);

        const getSendTx = (estimate
          ? doNotUseWhenEstimatingRejection
          : allowancePromise.then(() =>
              sendTx(sendTxArgs[0], sendTxArgs[1]),
            )) as ReturnType<typeof agent['mint']>['sendTx'];

        const txPromise = ((estimate
          ? doNotUseWhenEstimatingRejection
          : getSendTx) as ReturnType<typeof agent['mint']>['sendTx']).then(
          tx => tx.promiEvent,
        );

        return {
          type: 'swapAndMint',
          allowancePromise,
          sendTx: getSendTx,
          txPromise,
          estimatePromise: estimate
            ? sendTxArgs[0].estimateGas({
                value: (sendTxArgs[1] as any).value,
                gasPrice: sendTxArgs[1].gasPrice,
                from: sendTxArgs[1].from,
              })
            : doNotUseWhenNotEstimatingRejection,

          payValue: '',
          paySymbol: '',
          receiveValue: '',
          receiveSymbol: '',
          networkId: agent.realm.netId,
        };
      };
    }
    if (shouldRedeemAndSwap) {
      return (estimate?: FPN | null) => {
        if (estimate) throw new Error('Estimation is not supported');
        const w3 = assertNotNull(web3);
        const contract = new w3.eth.Contract(
          atomicSwapAbi as AbiItem[],
          agent.realm.netId === Network.polygon
            ? atomicSwapAddressPolygon
            : agent.realm.netId === Network.kovan
            ? atomicSwapAddressKovan
            : atomicSwapAddressMainnet,
        );

        const isBasePay = base === 'pay';

        const pay = isBasePay ? payValue : maximumSynthSentValue;

        const tokenAmountIn = pay!.format(assetPay!.decimals).replace('.', '');
        const tokenSwapPath = path!.map(token => token.address);
        const pool = assertNotNull(agent.activePools[paySymbol as 'jEUR']);
        const synthereumPool = pool.address;
        const redeemParams = {
          derivative: pool.derivative.address,
          numTokens: tokenAmountIn,
          minCollateral: isBasePay ? inputAmount : 0,
          feePercentage: `0x${new FPN(0.002).toString('hex')}`,
          expiration: getExpiration(deadline),
          recipient: '0x0000000000000000000000000000000000000000',
        };

        const allowancePromise = ensureSufficientAllowanceFor({
          tokenInfo: {
            address: pool.syntheticToken.address as AddressOn<NetworkName>,
            symbol: assetPay!.symbol,
            decimals: assetPay!.decimals,
            instance: getContract(
              w3 as any,
              ERC20_Abi,
              pool.syntheticToken.address as AddressOn<NetworkName>,
            ).instance,
          },
          account: address! as any,
          spender: (agent.realm.netId === Network.polygon
            ? atomicSwapAddressPolygon
            : agent.realm.netId === Network.kovan
            ? atomicSwapAddressKovan
            : atomicSwapAddressMainnet) as AddressOn<NetworkName>,
          necessaryAllowance: payValue!.bn as Amount,
          txOptions: { web3: w3 as any, from: address! as any, gasPrice },
        });

        const receive = isBasePay ? minimumReceiveValue : receiveValue;

        const getSendTx = allowancePromise.then(() =>
          sendTx(
            (assetReceive!.native
              ? isBasePay
                ? contract.methods.redeemAndSwapExactTokensForETH
                : contract.methods.redeemAndSwapTokensForExactETH
              : isBasePay
              ? contract.methods.redeemAndSwapExactTokens
              : contract.methods.redeemAndSwapTokensForExact)(
              receive!.format(assetReceive!.decimals).replace('.', ''),
              tokenSwapPath,
              synthereumPool,
              redeemParams,
              address,
            ),
            {
              printInfo: { log: console.log },
              web3: w3 as any,
              from: address as any,
              gasPrice,
              gasLimit,
            },
          ),
        );

        const txPromise = getSendTx.then(tx => tx.promiEvent);

        return {
          type: 'redeemAndSwap',
          allowancePromise,
          sendTx: getSendTx,
          txPromise,
          estimatePromise: estimationIsNotSupportedRejection,

          payValue: '',
          paySymbol: '',
          receiveValue: '',
          receiveSymbol: '',
          networkId: agent.realm.netId,
        };
      };
    }

    if (paySymbol === PRIMARY_STABLE_COIN.symbol) {
      // mint
      return (estimate?: FPN | null) => {
        if (estimate) throw new Error('Estimation is not supported');
        const collateral = weiFromFPN(payValue!);
        const outputSynth = receiveSymbol as SyntheticSymbol;
        const {
          allowancePromise,
          txPromise,
          sendTx: sendTxPromise,
        } = agent.mint({
          collateral,
          outputAmount: zero,
          outputSynth,
          expiration: getExpiration(deadline),
          txOptions: { gasPrice, gasLimit },
        });

        txPromise.then(result => console.log('Mint!', result)).catch(noop);

        return {
          allowancePromise,
          txPromise,
          sendTx: sendTxPromise,
          estimatePromise: estimationIsNotSupportedRejection,
          payValue: collateral.toString(),
          paySymbol: paySymbol as SyntheticSymbol,
          receiveValue: receiveValue!.toString(),
          receiveSymbol: outputSynth,
          type: 'mint' as SynthereumTransactionType,
          networkId: agent.realm.netId,
        };
      };
    }
    if (receiveSymbol === PRIMARY_STABLE_COIN.symbol) {
      // redeem
      return (estimate?: FPN | null) => {
        if (estimate) throw new Error('Estimation is not supported');
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const inputAmount = weiFromFPN(payValue!);
        const inputSynth = paySymbol as SyntheticSymbol;
        const {
          allowancePromise,
          txPromise,
          sendTx: sendTxPromise,
        } = agent.redeem({
          collateral: zero,
          inputAmount,
          inputSynth,
          expiration: getExpiration(deadline),
          txOptions: { gasPrice, gasLimit },
        });

        txPromise.then(result => console.log('Redeem!', result)).catch(noop);

        return {
          allowancePromise,
          txPromise,
          sendTx: sendTxPromise,
          estimatePromise: estimationIsNotSupportedRejection,
          payValue: inputAmount.toString(),
          paySymbol: inputSynth,
          receiveValue: receiveValue!.toString(),
          receiveSymbol: receiveSymbol as SyntheticSymbol,
          type: 'redeem' as SynthereumTransactionType,
          networkId: agent.realm.netId,
        };
      };
    }

    return (estimate?: FPN | null) => {
      if (estimate) throw new Error('Estimation is not supported');
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const inputAmount = weiFromFPN(payValue!);
      const inputSynth = paySymbol as SyntheticSymbol;
      const outputSynth = receiveSymbol as SyntheticSymbol;
      const {
        allowancePromise,
        txPromise,
        sendTx: sendTxPromise,
      } = agent.exchange({
        inputAmount,
        inputSynth,
        outputAmount: zero,
        outputSynth,
        expiration: getExpiration(deadline),
        txOptions: { gasPrice, gasLimit },
      });

      txPromise.then(result => console.log('Exchange!', result)).catch(noop);

      return {
        allowancePromise,
        txPromise,
        sendTx: sendTxPromise,
        estimatePromise: estimationIsNotSupportedRejection,
        payValue: inputAmount.toString(),
        paySymbol: inputSynth,
        receiveValue: receiveValue!.toString(),
        receiveSymbol: outputSynth,
        type: 'exchange' as SynthereumTransactionType,
        networkId: agent.realm.netId,
      };
    };
  }, [
    agent,
    paySymbol,
    receiveSymbol,
    shouldSwapAndMint,
    shouldRedeemAndSwap,
    web3,
    base,
    payValue,
    assetPay,
    path,
    minimumSynthReceiveValue,
    receiveValue,
    deadline,
    address,
    gasPrice,
    maximumSentValue,
    minimumReceiveValue,
    outputAmount,
    gasLimit,
    maximumSynthSentValue,
    inputAmount,
    assetReceive,
  ]);
};

function getExpiration(deadline: number) {
  return parseInt((Date.now() / 1000 + deadline * 60).toString(), 10);
}

function handledPromiseReject(message?: string) {
  return Promise.reject(new Error(message)).catch(e => e);
}
