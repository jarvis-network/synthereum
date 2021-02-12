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

export class RealmAgent<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  constructor(
    public readonly realm: SynthereumRealmWithWeb3<Net>,
    public readonly agentAddress: AddressOn<Net>,
    public readonly poolVersion: PoolVersion,
  ) {
    this.activePools = assertNotNull(realm.pools[poolVersion]);
    this.defaultTxOptions = {
      from: this.agentAddress,
      web3: this.realm.web3,
    };
  }

  private readonly activePools: PoolsForVersion<PoolVersion, Net>;
  private readonly defaultTxOptions: FullTxOptions<Net>;

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

  async mint({ collateral, outputAmount, outputSynth, txOptions }: MintParams) {
    this.assertV1Pool('mint');
    const tic = this.activePools[outputSynth] as SynthereumPool<'v1', Net>;
    // TODO: Should we return both promises separately?
    console.log(`Checking allowance...`);
    const result = await this.ensureSufficientAllowanceFor(
      this.realm.collateralToken,
      tic.address,
      collateral,
      txOptions,
    );
    console.log(`Allowance ok.`);
    const inputCollateral = weiToTokenAmount({
      wei: collateral,
      decimals: tic.collateralToken.decimals,
    });
    const tx = tic.instance.methods.mintRequest(
      inputCollateral as any,
      outputAmount as any,
    );
    console.log(`Sending tx`);
    return await sendTx(tx, {
      ...this.defaultTxOptions,
      ...txOptions,
    });
  }

  async exchange({
    collateral,
    inputSynth,
    outputSynth,
    inputAmount,
    outputAmount,
    txOptions,
  }: ExchangeParams) {
    this.assertV1Pool('mint');
    const inputTic = this.activePools[inputSynth] as SynthereumPool<'v1', Net>;
    const destinationTicAddress = assertNotNull(this.activePools[outputSynth])
      .address;
    const result = await this.ensureSufficientAllowanceFor(
      inputTic.syntheticToken,
      inputTic.address,
      inputAmount,
      txOptions,
    );
    console.log(`Allowance ok - ${result}`);
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
    return await sendTx(tx, {
      ...this.defaultTxOptions,
      ...txOptions,
    });
  }

  async redeem({
    inputAmount,
    inputSynth,
    collateral,
    txOptions,
  }: RedeemParams) {
    this.assertV1Pool('mint');
    const inputTic = this.activePools[inputSynth] as SynthereumPool<'v1', Net>;
    await this.ensureSufficientAllowanceFor(
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
    return await sendTx(tx, {
      ...this.defaultTxOptions,
      ...txOptions,
    });
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
