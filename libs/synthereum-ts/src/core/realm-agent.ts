import type { PromiEvent, TransactionReceipt } from 'web3-core';
import {
  Amount,
  formatAmount,
  maxUint256,
} from '@jarvis-network/core-utils/dist/base/big-number';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import {
  getTokenAllowance,
  getTokenBalance,
  scaleTokenAmountToWei,
  setTokenAllowance,
  weiToTokenAmount,
} from '@jarvis-network/core-utils/dist/eth/contracts/erc20';

import { TokenInfo } from '@jarvis-network/core-utils/dist/eth/contracts/types';
import { t } from '@jarvis-network/core-utils/dist/base/meta';

import {
  assert,
  assertNotNull,
} from '@jarvis-network/core-utils/dist/base/asserts';

import {
  FullTxOptions,
  sendTx,
  sendTxAndLog,
  TxOptions,
} from '@jarvis-network/core-utils/dist/eth/contracts/send-tx';

import {
  SupportedNetworkName,
  SyntheticSymbol,
  ExchangeToken,
  collateralSymbol,
} from '@jarvis-network/synthereum-contracts/dist/config';

import { NonPayableTransactionObject } from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';

import { mapPools } from './pool-utils';
import { PoolsForVersion, PoolVersion } from './types/pools';
import { SynthereumRealmWithWeb3 } from './types/realm';
import { determineSide, isSupportedCollateral } from './realm-utils';

interface BaseTxParams {
  expiration: number;
  txOptions?: TxOptions;
}

interface MintParams extends BaseTxParams {
  outputSynth: SyntheticSymbol;
  outputAmount: Amount;
  collateral: Amount;
}

interface ExchangeParams extends BaseTxParams {
  inputSynth: SyntheticSymbol;
  inputAmount: Amount;
  outputSynth: SyntheticSymbol;
  outputAmount: Amount;
}

interface RedeemParams extends BaseTxParams {
  inputSynth: SyntheticSymbol;
  inputAmount: Amount;
  collateral: Amount;
}

interface SwapResult {
  allowancePromise: Promise<true | TransactionReceipt>;
  txPromise: Promise<TransactionReceipt>;
  sendTx: Promise<{ promiEvent: PromiEvent<TransactionReceipt> }>;
}

export class RealmAgent<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  public readonly activePools: PoolsForVersion<PoolVersion, Net>;

  private readonly defaultTxOptions: FullTxOptions<Net>;

  constructor(
    public readonly realm: SynthereumRealmWithWeb3<Net>,
    public readonly agentAddress: AddressOn<Net>,
    public readonly poolVersion: PoolVersion,
  ) {
    this.activePools = assertNotNull(
      realm.pools[poolVersion],
      `realm.pools[${poolVersion}] is null`,
    );
    this.defaultTxOptions = {
      from: this.agentAddress,
      web3: this.realm.web3,
      confirmations: 1,
    };
  }

  collateralBalance(): Promise<Amount> {
    return getTokenBalance(this.realm.collateralToken, this.agentAddress);
  }

  syntheticTokenBalanceOf(synthetic: SyntheticSymbol): Promise<Amount> {
    const asset = assertNotNull(
      this.activePools[synthetic],
      'this.activePools[synthetic] is null',
    ).syntheticToken;
    return getTokenBalance(asset, this.agentAddress);
  }

  getAllBalances(): Promise<[ExchangeToken, Amount][]> {
    return Promise.all([
      (async (): Promise<[ExchangeToken, Amount]> =>
        t(
          collateralSymbol,
          await getTokenBalance(this.realm.collateralToken, this.agentAddress),
        ))(),
      ...mapPools(this.realm, this.poolVersion, async p =>
        t(p.symbol, await getTokenBalance(p.syntheticToken, this.agentAddress)),
      ),
    ]);
  }

  mint({
    collateral,
    outputAmount,
    outputSynth,
    expiration,
    txOptions,
  }: MintParams): SwapResult {
    return this.universalExchange({
      inputToken: this.realm.collateralToken.symbol as ExchangeToken,
      outputToken: outputSynth,
      inputAmountWei: collateral,
      outputAmountWei: outputAmount,
      expiration,
      txOptions,
    });
  }

  exchange({
    inputSynth,
    outputSynth,
    inputAmount,
    outputAmount,
    expiration,
    txOptions,
  }: ExchangeParams): SwapResult {
    return this.universalExchange({
      inputToken: inputSynth,
      outputToken: outputSynth,
      inputAmountWei: inputAmount,
      outputAmountWei: outputAmount,
      expiration,
      txOptions,
    });
  }

  redeem({
    inputAmount,
    inputSynth,
    collateral,
    expiration,
    txOptions,
  }: RedeemParams): SwapResult {
    return this.universalExchange({
      inputToken: inputSynth,
      outputToken: this.realm.collateralToken.symbol as ExchangeToken,
      inputAmountWei: inputAmount,
      outputAmountWei: collateral,
      expiration,
      txOptions,
    });
  }

  private determineSide(input: ExchangeToken, output: ExchangeToken) {
    return determineSide(this.activePools, input, output);
  }

  private isCollateral(token: ExchangeToken) {
    return isSupportedCollateral(this.activePools, token);
  }

  // TODO: Make this public and remove mint/exchange/redeem functions
  private universalExchange({
    inputToken,
    outputToken,
    inputAmountWei,
    outputAmountWei,
    expiration,
    txOptions,
  }: {
    inputToken: ExchangeToken;
    outputToken: ExchangeToken;
    inputAmountWei: Amount;
    outputAmountWei: Amount;
    expiration: number;
    txOptions?: TxOptions;
  }): SwapResult {
    const side = this.determineSide(inputToken, outputToken);

    assert(
      side !== 'unsupported',
      'Unsupported exchange: ' +
        `input ${inputAmountWei} ${inputToken} -> output ${outputAmountWei} ${outputToken}`,
    );

    const inputPool =
      side === 'mint'
        ? null
        : assertNotNull(
            this.activePools[inputToken as SyntheticSymbol],
            'this.activePools[inputToken as SyntheticSymbol] is null',
          );

    const outputPool =
      side === 'redeem'
        ? null
        : assertNotNull(
            this.activePools[outputToken as SyntheticSymbol],
            'this.activePools[outputToken as SyntheticSymbol] is null',
          );

    // TODO: optimize by caching the fee during realm load
    // const [
    //   [feePercentage],
    // ] = await targetPool.instance.methods.getFeeInfo().call();

    // FIXME: avoid calling the smart contract to keep the function sync:
    const feePercentage = new FPN(0.002);

    const allowancePromise = this.ensureSufficientAllowanceFor(
      side === 'mint' ? outputPool!.collateralToken : inputPool!.syntheticToken,
      side === 'mint' ? outputPool!.address : inputPool!.address,
      inputAmountWei,
      txOptions,
    );

    const inputAmount = this.isCollateral(inputToken)
      ? weiToTokenAmount({
          wei: inputAmountWei,
          decimals:
            side === 'mint'
              ? outputPool!.collateralToken.decimals
              : inputPool!.collateralToken.decimals,
        })
      : inputAmountWei;

    const outputAmount = this.isCollateral(outputToken)
      ? weiToTokenAmount({
          wei: outputAmountWei,
          decimals:
            side === 'mint'
              ? outputPool!.collateralToken.decimals
              : inputPool!.collateralToken.decimals,
        })
      : outputAmountWei;

    // TODO: Refactor to make the code more extensible
    let tx: NonPayableTransactionObject<unknown>;
    if (side === 'mint') {
      tx = outputPool!.instance.methods[side]([
        outputPool!.derivative.address,
        `0x${outputAmount.toString('hex')}`,
        `0x${inputAmount.toString('hex')}`,
        `0x${feePercentage.toString('hex')}`,
        expiration,
        this.agentAddress,
      ]);
    } else if (side === 'exchange') {
      tx = inputPool!.instance.methods[side]([
        inputPool!.derivative.address,
        outputPool!.address,
        outputPool!.derivative.address,
        `0x${inputAmount.toString('hex')}`,
        `0x${outputAmount.toString('hex')}`,
        `0x${feePercentage.toString('hex')}`,
        expiration,
        this.agentAddress,
      ]);
    } else if (side === 'redeem') {
      tx = inputPool!.instance.methods[side]([
        inputPool!.derivative.address,
        `0x${inputAmount.toString('hex')}`,
        `0x${outputAmount.toString('hex')}`,
        `0x${feePercentage.toString('hex')}`,
        expiration,
        this.agentAddress,
      ]);
    }

    const getSendTx = allowancePromise.then(() =>
      sendTx(tx, {
        ...this.defaultTxOptions,
        ...txOptions,
      }),
    );

    const txPromise = getSendTx.then(result => result.promiEvent);

    return {
      allowancePromise,
      txPromise,
      sendTx: getSendTx,
    };
  }

  private async ensureSufficientAllowanceFor(
    tokenInfo: TokenInfo<Net>,
    spender: AddressOn<Net>,
    necessaryAllowance: Amount,
    txOptions?: TxOptions,
  ) {
    console.log('Checking allowance...');
    const allowance = await getTokenAllowance(
      tokenInfo,
      this.agentAddress,
      spender,
    );
    if (allowance.lt(necessaryAllowance)) {
      console.log(
        `Allowance of ${spender} is ${formatAmount(
          allowance,
        )}, which is less than required ${formatAmount(necessaryAllowance)}`,
      );
      const max = scaleTokenAmountToWei({
        amount: maxUint256,
        decimals: tokenInfo.decimals,
      });
      const tx = setTokenAllowance(tokenInfo, spender, max);
      return sendTxAndLog(tx, {
        ...this.defaultTxOptions,
        ...txOptions,
      });
    }
    console.log(
      `Allowance of ${spender} is ${formatAmount(
        allowance,
      )}, which is sufficient`,
    );
    return true;
  }
}
