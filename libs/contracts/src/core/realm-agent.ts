import BN from 'bn.js';

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

import { SynthereumRealmWithWeb3 } from './types';
import {
  allSupportedSymbols,
  SyntheticSymbol,
} from '../config/data/all-synthetic-asset-symbols';
import { SupportedNetworkName } from '../config';
import { NonPayableTransactionObject } from '../contracts/typechain';
import { TokenInfo } from '@jarvis-network/web3-utils/eth/contracts/types';
import { t } from '@jarvis-network/web3-utils/base/meta';

export interface GasOptions {
  gasLimit?: BN;
  gasPrice?: BN;
}

interface BaseTxParams {
  collateral: Amount;
  txOptions?: GasOptions;
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
  ) {}

  async collateralBalance(): Promise<Amount> {
    return await getTokenBalance(this.realm.collateralToken, this.agentAddress);
  }

  async syntheticTokenBalanceOf(synthetic: SyntheticSymbol): Promise<Amount> {
    const asset = this.realm.ticInstances[synthetic].syntheticToken;
    return await getTokenBalance(asset, this.agentAddress);
  }

  async mint({
    collateral,
    outputAmount,
    outputSynth,
    txOptions = {},
  }: MintParams) {
    const tic = this.realm.ticInstances[outputSynth];
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
    }) as any;
    const tx = tic.instance.methods.mintRequest(
      inputCollateral,
      outputAmount as any,
    );
    console.log(`Sending tx`);
    return await this.sendTx(tx, txOptions);
  }

  async exchange({
    collateral,
    inputSynth,
    outputSynth,
    inputAmount,
    outputAmount,
    txOptions = {},
  }: ExchangeParams) {
    const inputTic = this.realm.ticInstances[inputSynth];
    const destinationTicAddress = this.realm.ticInstances[outputSynth].address;
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
    return await this.sendTx(tx, txOptions);
  }

  async redeem({
    inputAmount,
    inputSynth,
    collateral,
    txOptions = {},
  }: RedeemParams) {
    const inputTic = this.realm.ticInstances[inputSynth];
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
    return await this.sendTx(tx, txOptions);
  }

  private async ensureSufficientAllowanceFor(
    tokenInfo: TokenInfo<Net>,
    spender: AddressOn<Net>,
    necessaryAllowance: Amount,
    txOptions: GasOptions,
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
      const x = setTokenAllowance(tokenInfo, spender, max);
      return await this.sendTx(x, txOptions);
    } else {
      console.log(
        `Allowance of ${spender} is ${formatAmount(
          allowance,
        )}, which is sufficient`,
      );
      return true;
    }
  }

  private sendTx<T>(
    tx: NonPayableTransactionObject<T>,
    txOptions?: GasOptions,
  ) {
    return tx.send({
      from: this.agentAddress,
      chainId: this.realm.netId,
      gas: txOptions?.gasLimit?.toString(10),
      gasPrice: txOptions?.gasPrice?.toString(10),
    });
  }
}

export async function getAllBalances(realmAgent: RealmAgent<'kovan'>) {
  const usdcBalancePromise = t(
    realmAgent.realm.collateralToken.symbol,
    await realmAgent.collateralBalance(),
  );
  const allSyntheticTokenBalancePromises = allSupportedSymbols.map(
    async asset => t(asset, await realmAgent.syntheticTokenBalanceOf(asset)),
  );
  const allBalances = Promise.all([
    usdcBalancePromise,
    ...allSyntheticTokenBalancePromises,
  ]);
  return allBalances;
}
