import type { PromiEvent, TransactionReceipt } from 'web3-core';
import {
  Amount,
  formatAmount,
  maxUint256,
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

import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

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

import { mapPools } from './pool-utils';
import { PoolsForVersion, PoolVersion, SynthereumPool } from './types/pools';
import { SynthereumRealmWithWeb3 } from './types/realm';

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
      'realm.pools[poolVersion] is null',
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

  assertV1Pool(operation: string) {
    if (this.poolVersion !== 'v1') {
      throw new Error(
        `'${this.poolVersion}' support for '${operation}' is not implemented yet.`,
      );
    }
  }

  mint({
    collateral,
    outputAmount,
    outputSynth,
    txOptions,
  }: MintParams): SwapResult {
    this.assertV1Pool('mint');

    const tic = this.activePools[outputSynth] as SynthereumPool<'v1', Net>;

    const allowancePromise = this.ensureSufficientAllowanceFor(
      this.realm.collateralToken,
      tic.address,
      collateral,
      txOptions,
    );

    const inputCollateral = weiToTokenAmount({
      wei: collateral,
      decimals: tic.collateralToken.decimals,
    });

    const tx = tic.instance.methods.mintRequest(
      inputCollateral as any,
      outputAmount as any,
    );

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

  exchange({
    collateral,
    inputSynth,
    outputSynth,
    inputAmount,
    outputAmount,
    txOptions,
  }: ExchangeParams): SwapResult {
    this.assertV1Pool('mint');
    const inputTic = this.activePools[inputSynth] as SynthereumPool<'v1', Net>;

    const destinationTicAddress = assertNotNull(
      this.activePools[outputSynth],
      'this.activePools[outputSynth] is null',
    ).address;

    const allowancePromise = this.ensureSufficientAllowanceFor(
      inputTic.syntheticToken,
      inputTic.address,
      inputAmount,
      txOptions,
    );

    const inputCollateral = weiToTokenAmount({
      wei: collateral,
      decimals: inputTic.collateralToken.decimals,
    });

    const tx = inputTic.instance.methods.exchangeRequest(
      destinationTicAddress,
      inputAmount as any,
      inputCollateral as any,
      outputAmount as any,
    );

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

  redeem({
    inputAmount,
    inputSynth,
    collateral,
    txOptions,
  }: RedeemParams): SwapResult {
    this.assertV1Pool('mint');
    const inputTic = this.activePools[inputSynth] as SynthereumPool<'v1', Net>;

    const allowancePromise = this.ensureSufficientAllowanceFor(
      inputTic.syntheticToken,
      inputTic.address,
      inputAmount,
      txOptions,
    );

    const outputCollateral = weiToTokenAmount({
      wei: collateral,
      decimals: inputTic.collateralToken.decimals,
    });

    const tx = inputTic.instance.methods.redeemRequest(
      outputCollateral as any,
      inputAmount as any,
    );

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
