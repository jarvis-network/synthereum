import BN from 'bn.js';

import { Amount, maxUint256 } from '@jarvis-network/web3-utils/base/big-number';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';
import {
  getTokenAllowance,
  getTokenBalance,
  setTokenAllowance,
} from '@jarvis-network/web3-utils/eth/contracts/erc20';

import { SynthereumRealmWithWeb3 } from './types';
import { allSymbols as allSyntheticAssets, SyntheticSymbol } from '../config/data/all-synthetic-asset-symbols';
import { SupportedNetworkName } from '../config';
import { NonPayableTransactionObject } from '../contracts/typechain';
import { TokenInfo } from '@jarvis-network/web3-utils/eth/contracts/types';
import { t } from '@jarvis-network/web3-utils/base/meta';

export interface GasOptions {
  gasLimit?: BN;
  gasPrice?: BN;
}

interface BaseTxParams {
  collateral: BN;
  txOptions?: GasOptions;
}

interface MintParams extends BaseTxParams {
  outputSynth: SyntheticSymbol;
  outputAmount: Amount;
}

interface ExchangeParams extends BaseTxParams {
  inputSynth: SyntheticSymbol;
  inputAmount: BN;
  outputSynth: SyntheticSymbol;
  outputAmount: BN;
}

interface RedeemParams extends BaseTxParams {
  inputSynth: SyntheticSymbol;
  inputAmount: BN;
}

export class RealmAgent<Net extends SupportedNetworkName> {
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
    await this.ensureSufficientAllowanceFor(
      this.realm.collateralToken,
      tic.address,
    );
    const tx = tic.instance.methods.mintRequest(
      collateral.toString(10),
      outputAmount.toString(10),
    );
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
    // TODO: Should we return both promises separately?
    await this.ensureSufficientAllowanceFor(
      inputTic.syntheticToken,
      inputTic.address,
    );
    const tx = inputTic.instance.methods.exchangeRequest(
      destinationTicAddress,
      inputAmount.toString(10),
      collateral.toString(10),
      outputAmount.toString(10),
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
    // TODO: Should we return both promises separately?
    await this.ensureSufficientAllowanceFor(
      inputTic.syntheticToken,
      inputTic.address,
    );
    const tx = inputTic.instance.methods.redeemRequest(
      collateral.toString(10),
      inputAmount.toString(10),
    );
    return await this.sendTx(tx, txOptions);
  }

  private async ensureSufficientAllowanceFor(
    tokenInfo: TokenInfo<Net>,
    spender: AddressOn<Net>,
    necessaryAllowance: Amount = maxUint256 as Amount,
  ) {
    const allowance = await getTokenAllowance(
      tokenInfo,
      this.agentAddress,
      spender,
    );
    if (allowance.lt(necessaryAllowance)) {
      await setTokenAllowance(tokenInfo, spender, necessaryAllowance);
    }
  }

  private sendTx<T>(tx: NonPayableTransactionObject<T>, txOptions: GasOptions) {
    return tx.send({
      from: this.agentAddress,
      chainId: this.realm.netId,
      gas: txOptions?.gasLimit?.toString(10),
      gasPrice: txOptions?.gasPrice?.toString(10),
    });
  }
}

export async function getAllBalances(realmAgent: RealmAgent<'kovan'>) {
  const usdcBalancePromise = t(realmAgent.realm.collateralToken.symbol, await realmAgent.collateralBalance());
  const allSyntheticTokenBalancePromises = allSyntheticAssets.map(async asset =>
    t(asset, await realmAgent.syntheticTokenBalanceOf(asset)),
  );
  const allBalances = Promise.all([
    usdcBalancePromise,
    ...allSyntheticTokenBalancePromises,
  ]);
  return allBalances;
}
