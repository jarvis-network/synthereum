import BN from 'bn.js';

import { Amount } from '@jarvis-network/web3-utils/base/big-number';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { ToNetworkId } from '@jarvis-network/web3-utils/eth/networks';
import { getTokenBalance } from '@jarvis-network/web3-utils/eth/contracts/erc20';

import { SynthereumRealm } from './types';
import { SyntheticSymbol } from '../config/data/all-synthetic-asset-symbols';
import { SupportedNetworkName } from '../config/types';
import { NonPayableTransactionObject } from '../contracts/typechain';

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
    public readonly realm: SynthereumRealm<Net>,
    public readonly netId: ToNetworkId<Net>,
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
    const tx = this.realm.ticInstances[
      outputSynth
    ].instance.methods.mintRequest(
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
    const sourceTic = this.realm.ticInstances[inputSynth].instance;
    const destinationTicAddress = this.realm.ticInstances[outputSynth].address;
    const tx = sourceTic.methods.exchangeRequest(
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
    const tx = this.realm.ticInstances[
      inputSynth
    ].instance.methods.redeemRequest(
      collateral.toString(10),
      inputAmount.toString(10),
    );
    return await this.sendTx(tx, txOptions);
  }

  private sendTx<T>(tx: NonPayableTransactionObject<T>, txOptions: GasOptions) {
    return tx.send({
      from: this.agentAddress,
      chainId: this.netId,
      gas: txOptions?.gasLimit?.toString(10),
      gasPrice: txOptions?.gasPrice?.toString(10),
    });
  }
}
