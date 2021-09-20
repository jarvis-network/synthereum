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
import _ from 'lodash';
import { TokenInstance } from '@jarvis-network/core-utils/dist/eth/contracts/types';

import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';
import { FullTxOptions } from '@jarvis-network/core-utils/dist/eth/contracts/send-tx';

import {
  ExchangeSelfMintingToken,
  SupportedNetworkName,
  SupportedSelfMintingPairExact,
} from '@jarvis-network/synthereum-config';

import { entriesOf, t } from '@jarvis-network/core-utils/dist/base/meta';

import { NonPayableTransactionObject } from '@jarvis-network/synthereum-contracts/dist/contracts/typechain';

import { SelfMintingRealmWithWeb3 } from '../../types/realm';
import {
  DerivativesForVersion,
  SelfMintingVersion,
} from '../../types/self-minting-derivatives';

import { ContractParams } from './interfaces';

interface PositionData {
  positionTokens: Amount;
  positionCollateral: Amount;
  positionWithdrawalRequestAmount: Amount;
  positionWithdrawalRequestPassTimestamp: number;
}
export class SelfMintingRealmAgent<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  public readonly activeDerivatives: DerivativesForVersion<
    SelfMintingVersion,
    Net
  >;

  private readonly defaultTxOptions: FullTxOptions<Net>;

  constructor(
    public readonly realm: SelfMintingRealmWithWeb3<Net>,
    public readonly agentAddress: AddressOn<Net>,
    public readonly derivativeVersion: SelfMintingVersion,
  ) {
    this.activeDerivatives = realm.selfMintingDerivatives[derivativeVersion]!;
    this.defaultTxOptions = {
      from: this.agentAddress,
      web3: this.realm.web3,

      printInfo: {
        log: console.log,
      },
    };
  }

  async getPositionsData(
    synthetic: SupportedSelfMintingPairExact<Net>,
  ): Promise<PositionData> {
    if (!this.agentAddress) {
      return {
        positionTokens: wei('0'),
        positionCollateral: wei('0'),
        positionWithdrawalRequestAmount: wei('0'),
        positionWithdrawalRequestPassTimestamp: 0,
      };
    }
    const asset = this.activeDerivatives[synthetic]!;
    const userPositionsData = await asset.instance.methods
      .positions(this.agentAddress)
      .call();
    const positionTokens = scaleTokenAmountToWei({
      amount: wei(userPositionsData.tokensOutstanding[0]),
      decimals: asset.static.syntheticToken.decimals,
    });
    const positionCollateral = scaleTokenAmountToWei({
      amount: wei(userPositionsData.rawCollateral[0]),
      decimals: asset.static.collateralToken.decimals,
    });
    const positionWithdrawalRequestAmount = scaleTokenAmountToWei({
      amount: wei(userPositionsData.withdrawalRequestAmount[0]),
      decimals: asset.static.collateralToken.decimals,
    });

    const positionWithdrawalRequestPassTimestamp = parseInt(
      userPositionsData.withdrawalRequestPassTimestamp,
      10,
    );
    return {
      positionTokens,
      positionCollateral,
      positionWithdrawalRequestAmount,
      positionWithdrawalRequestPassTimestamp,
    };
  }

  async collateralRequirement(synthetic: SupportedSelfMintingPairExact<Net>) {
    const asset = this.activeDerivatives[synthetic]!.instance;
    return (await asset.methods.liquidatableData().call())
      .collateralRequirement[0];
  }

  async getAllBalances(
    symbols: ExchangeSelfMintingToken[] = [],
  ): Promise<[ExchangeSelfMintingToken, Amount][]> {
    try {
      if (symbols && symbols.length > 0) {
        return await Promise.all(
          symbols.map(async item => {
            // #TODO: Improve this hack
            const { symbol, instance, decimals } = this.realm.tokens[
              item
            ] as TokenInstance<Net>;
            const [symbol_, token] = [symbol, { instance, decimals }] as [
              ExchangeSelfMintingToken,
              TokenInstance<Net>,
            ];
            return t(symbol_, await getTokenBalance(token, this.agentAddress));
          }),
        );
      }

      return await Promise.all(
        entriesOf(this.realm.tokens).map(async item => {
          const [symbol, token] = item as [
            ExchangeSelfMintingToken,
            TokenInstance<Net>,
          ];
          return t(symbol, await getTokenBalance(token, this.agentAddress));
        }),
      );
    } catch (error) {
      throw new Error('Unable to get balance');
    }
  }

  borrow(input: ContractParams<Net>): NonPayableTransactionObject<any> {
    console.log('Am here');
    const derivativeInstance = assertNotNull(
      this.activeDerivatives[input.pair],
    )!;
    const collateralInput = weiToTokenAmount({
      wei: wei(input.collateral),
      decimals: derivativeInstance.static.collateralToken.decimals,
    });

    return derivativeInstance.instance.methods.create(
      collateralInput.toString(),
      input.numTokens,
      input.feePercentage,
    );
  }

  repay(input: ContractParams<Net>): NonPayableTransactionObject<any> {
    const derivativeInstance = assertNotNull(
      this.activeDerivatives[input.pair],
    )!;

    const tokensInput = weiToTokenAmount({
      wei: wei(input.numTokens),
      decimals: derivativeInstance.static.syntheticToken.decimals,
    });

    return derivativeInstance.instance.methods.repay(
      tokensInput,
      input.feePercentage,
    );
  }

  redeem(input: ContractParams<Net>): NonPayableTransactionObject<any> {
    const derivativeInstance = assertNotNull(
      this.activeDerivatives[input.pair],
    )!;

    const tokensInput = weiToTokenAmount({
      wei: wei(input.numTokens),
      decimals: derivativeInstance.static.syntheticToken.decimals,
    });

    return derivativeInstance.instance.methods.redeem(
      tokensInput,
      input.feePercentage,
    );
  }

  deposit(input: ContractParams<Net>): NonPayableTransactionObject<any> {
    const derivativeInstance = assertNotNull(
      this.activeDerivatives[input.pair],
    )!;
    const collateralInput = weiToTokenAmount({
      wei: wei(input.collateral),
      decimals: derivativeInstance.static.collateralToken.decimals,
    });

    return derivativeInstance.instance.methods.deposit(
      collateralInput.toString(),
    );
  }

  withdraw(input: ContractParams<Net>): NonPayableTransactionObject<any> {
    const derivativeInstance = assertNotNull(
      this.activeDerivatives[input.pair],
    )!;
    const collateralInput = weiToTokenAmount({
      wei: wei(input.collateral),
      decimals: derivativeInstance.static.collateralToken.decimals,
    });

    let tx: any;
    if (input.slow) {
      tx = derivativeInstance.instance.methods.requestWithdrawal(
        collateralInput.toString(),
      );
    } else {
      tx = derivativeInstance.instance.methods.withdraw(
        collateralInput.toString(),
      );
    }
    return tx;
  }

  cancelWithdraw(input: ContractParams<Net>): NonPayableTransactionObject<any> {
    const derivativeInstance = assertNotNull(
      this.activeDerivatives[input.pair],
    )!;
    return derivativeInstance.instance.methods.cancelWithdrawal();
  }

  approveWithdraw(
    input: ContractParams<Net>,
  ): NonPayableTransactionObject<any> {
    const derivativeInstance = assertNotNull(
      this.activeDerivatives[input.pair],
    )!;
    return derivativeInstance.instance.methods.withdrawPassedRequest();
  }

  public async isSufficientAllowanceFor(
    pair: SupportedSelfMintingPairExact<Net>,
    tokenType: 'collateralToken' | 'syntheticToken',
    necessaryAllowance: Amount,
  ): Promise<boolean> {
    const derivative = this.activeDerivatives[pair]!;
    const spender = derivative.address;
    const token = derivative.static[tokenType];
    const tokenInstance = {
      ...token,
      instance: token.connect(this.realm.web3),
    };

    console.log('Checking allowance...');
    const allowance = await getTokenAllowance(
      tokenInstance,
      this.agentAddress,
      spender,
    );
    if (allowance.lt(necessaryAllowance)) {
      console.log(
        `Allowance of ${spender} is ${formatAmount(
          allowance,
        )}, which is less than required ${formatAmount(necessaryAllowance)}`,
      );
      return false;
    }
    console.log(
      `Allowance of ${spender} is ${formatAmount(
        allowance,
      )}, which is sufficient`,
    );
    return true;
  }

  public increaseAllowance(
    pair: SupportedSelfMintingPairExact<Net>,
    tokenType: 'collateralToken' | 'syntheticToken',
  ): NonPayableTransactionObject<any> {
    const derivative = this.activeDerivatives[pair]!;
    const spender = derivative.address;
    const token = derivative.static[tokenType];
    const tokenInstance = {
      ...token,
      instance: token.connect(this.realm.web3),
    };

    const max = scaleTokenAmountToWei({
      amount: maxUint256,
      decimals: token.decimals,
    });

    return setTokenAllowance(tokenInstance, spender, max);
  }
}
