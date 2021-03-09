import type { TransactionReceipt } from 'web3-core';
import {
  Amount,
  formatAmount,
  maxUint256,
} from '@jarvis-network/web3-utils/base/big-number';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import {
  getTokenAllowance,
  getTokenBalance,
  scaleTokenAmountToWei,
  setTokenAllowance,
  weiToTokenAmount,
} from '@jarvis-network/web3-utils/eth/contracts/erc20';

import { SynthereumRealmWithWeb3 } from './types/realm';
import {
  SupportedNetworkName,
  SyntheticSymbol,
  ExchangeToken,
} from '../config';
import { TokenInfo } from '@jarvis-network/web3-utils/eth/contracts/types';
import { t } from '@jarvis-network/web3-utils/base/meta';
import { PoolsForVersion, PoolVersion, SynthereumPool } from './types/pools';
import { assertNotNull } from '@jarvis-network/web3-utils/base/asserts';
import { mapPools } from './pool-utils';
import {
  FullTxOptions,
  sendTx,
  TxOptions,
} from '@jarvis-network/web3-utils/eth/contracts/send-tx';

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
  txPromise: Promise<TransactionReceipt>
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
    this.activePools = assertNotNull(realm.pools[poolVersion]);
    this.defaultTxOptions = {
      from: this.agentAddress,
      web3: this.realm.web3,
      confirmations: 1,
    };
  }

  async collateralBalance(): Promise<Amount> {
    return await getTokenBalance(this.realm.collateralToken, this.agentAddress);
  }

  async syntheticTokenBalanceOf(synthetic: SyntheticSymbol): Promise<Amount> {
    const asset = assertNotNull(this.activePools[synthetic]).syntheticToken;
    return await getTokenBalance(asset, this.agentAddress);
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

  mint({ collateral, outputAmount, outputSynth, txOptions }: MintParams): SwapResult {
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

    const txPromise = allowancePromise.then(() => sendTx(tx, {
      ...this.defaultTxOptions,
      ...txOptions,
    }));

    return {
      allowancePromise,
      txPromise
    }
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

    const destinationTicAddress = assertNotNull(this.activePools[outputSynth])
      .address;

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

    const txPromise = allowancePromise.then(() => sendTx(tx, {
      ...this.defaultTxOptions,
      ...txOptions,
    }));

    return {
      allowancePromise,
      txPromise
    }
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

    const txPromise = allowancePromise.then(() => sendTx(tx, {
      ...this.defaultTxOptions,
      ...txOptions,
    }));

    return {
      allowancePromise,
      txPromise
    }
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
      return await sendTx(tx, {
        ...this.defaultTxOptions,
        ...txOptions,
      });
    } else {
      console.log(
        `Allowance of ${spender} is ${formatAmount(
          allowance,
        )}, which is sufficient`,
      );
      return true;
    }
  }
}
