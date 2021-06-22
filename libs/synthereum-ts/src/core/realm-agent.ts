import type { PromiEvent, TransactionReceipt } from 'web3-core';
import {
  Amount,
  formatAmount,
  maxUint256,
  wei,
} from '@jarvis-network/core-utils/dist/base/big-number';
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
} from '@jarvis-network/synthereum-contracts/dist/config';

import { NonPayableTransactionObject } from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';

import { mapPools } from './pool-utils';
import { PoolsForVersion, PoolVersion } from './types/pools';
import { SynthereumRealmWithWeb3 } from './types/realm';
import { determineSide, isSupportedCollateral } from './realm-utils';

interface BaseTxParams {
  collateral: Amount;
  txOptions?: TxOptions;
}

interface MintParams extends BaseTxParams {
  outputSynth: SyntheticSymbol;
  outputAmount: Amount;
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
          'USDC' as const,
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
    txOptions,
  }: MintParams): SwapResult {
    return this.universalExchange({
      inputToken: this.realm.collateralToken.symbol as ExchangeToken,
      outputToken: outputSynth,
      inputAmountWei: collateral,
      outputAmountWei: outputAmount,
      txOptions,
    });
  }

  exchange({
    inputSynth,
    outputSynth,
    inputAmount,
    outputAmount,
    txOptions,
  }: ExchangeParams): SwapResult {
    return this.universalExchange({
      inputToken: inputSynth,
      outputToken: outputSynth,
      inputAmountWei: inputAmount,
      outputAmountWei: outputAmount,
      txOptions,
    });
  }

  redeem({
    inputAmount,
    inputSynth,
    collateral,
    txOptions,
  }: RedeemParams): SwapResult {
    return this.universalExchange({
      inputToken: inputSynth,
      outputToken: this.realm.collateralToken.symbol as ExchangeToken,
      inputAmountWei: inputAmount,
      outputAmountWei: collateral,
      txOptions,
    });
  }

  private determineSide(input: ExchangeToken, output: ExchangeToken) {
    return determineSide(this.activePools, input, output);
  }

  private isCollateral(token: ExchangeToken) {
    return isSupportedCollateral(this.activePools, token);
  }

  private static getExpiration(): number {
    const timeout = 4 * 3600;
    return ((Date.now() / 1000) | 0) + timeout;
  }

  // TODO: Make this public and remove mint/exchange/redeem functions
  private universalExchange({
    inputToken,
    outputToken,
    inputAmountWei,
    outputAmountWei,
    txOptions,
  }: {
    inputToken: ExchangeToken;
    outputToken: ExchangeToken;
    inputAmountWei: Amount;
    outputAmountWei: Amount;
    txOptions?: TxOptions;
  }): SwapResult {
    const side = this.determineSide(inputToken, outputToken);

    assert(
      side !== 'unsupported',
      'Unsupported exchange: ' +
        `input ${inputAmountWei} ${inputToken} -> output ${outputAmountWei} ${outputToken}`,
    );

    const targetPool = assertNotNull(
      this.activePools[inputToken as SyntheticSymbol],
    );

    // TODO: optimize by caching the fee during realm load
    // const [
    //   [feePercentage],
    // ] = await targetPool.instance.methods.getFeeInfo().call();

    // FIXME: avoid calling the smart contract to keep the function sync:
    const feePercentage = wei('0.002');

    const allowancePromise = this.ensureSufficientAllowanceFor(
      targetPool.collateralToken,
      targetPool.address,
      inputAmountWei,
      txOptions,
    );

    const inputAmount = this.isCollateral(inputToken)
      ? weiToTokenAmount({
          wei: inputAmountWei,
          decimals: targetPool.collateralToken.decimals,
        })
      : inputAmountWei;

    const outputAmount = this.isCollateral(outputToken)
      ? weiToTokenAmount({
          wei: outputAmountWei,
          decimals: targetPool.collateralToken.decimals,
        })
      : outputAmountWei;

    // TODO: Refactor to make the code more extensible
    let tx: NonPayableTransactionObject<unknown>;
    if (side === 'mint') {
      tx = targetPool.instance.methods[side]([
        targetPool.derivative.address,
        outputAmount,
        inputAmount,
        feePercentage,
        RealmAgent.getExpiration(),
        this.agentAddress,
      ]);
    } else if (side === 'exchange') {
      const outputPool = assertNotNull(
        this.activePools[outputToken as SyntheticSymbol],
        `activePools[${outputToken}] is null`,
      );
      tx = targetPool.instance.methods[side]([
        targetPool.derivative.address,
        outputPool.address,
        outputPool.derivative.address,
        inputAmount,
        outputAmount,
        feePercentage,
        RealmAgent.getExpiration(),
        this.agentAddress,
      ]);
    } else if (side === 'redeem') {
      tx = targetPool.instance.methods[side]([
        targetPool.derivative.address,
        inputAmount,
        outputAmount,
        feePercentage,
        RealmAgent.getExpiration(),
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
