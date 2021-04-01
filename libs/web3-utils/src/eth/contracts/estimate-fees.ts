import BN from 'bn.js';
import { toBN, toWei } from 'web3-utils';

import { getEthUsdBtcPrice } from '../../apis/etherscan';
import { fromBNToDecimalString } from '../../base/big-number';
import { assertIsFiniteNumber, assertIsString } from '../../base/asserts';

import { NonPayableTransactionObject, BaseContract } from './typechain/types';

export type TxObjFeeEstimator = <T>(
  txObj: NonPayableTransactionObject<T>,
) => Promise<{ allowance: number; gas?: number; feeEth?: BN; feeUsd?: string }>;

export interface FeeEstimation {
  gasLimit: number;
  gasPriceGwei: string;
  usdEthRate: string;
  maxFeeEth: string;
  maxFeeUsd: string;
  usdEthPriceTimestamp: Date;
  estimateFeesForTx: TxObjFeeEstimator;
}

export async function estimateFee(
  contract: BaseContract,
): Promise<FeeEstimation> {
  const { gas: gas_, gasPrice: gasPrice_ } = contract.options;
  const gasLimit = assertIsFiniteNumber(gas_);
  const gasPrice = assertIsString(gasPrice_);
  const gasPriceBn = toBN(gasPrice);
  const maxFeeWei = toBN(assertIsFiniteNumber(gasLimit)).mul(gasPriceBn);
  const { ethusd, ethusd_timestamp } = await getEthUsdBtcPrice();
  const ethUsdBn = toBN(toWei(ethusd));
  const maxFeeEth = fromBNToDecimalString(maxFeeWei);
  const maxFeeUsd = fromBNToDecimalString(
    maxFeeWei.mul(ethUsdBn).div(toBN(1e18)),
  );
  return {
    gasLimit,
    gasPriceGwei: `${Number.parseFloat(gasPrice) / 1e9} Gwei`,
    usdEthRate: ethusd,
    maxFeeEth,
    maxFeeUsd,
    usdEthPriceTimestamp: new Date(
      Number.parseInt(ethusd_timestamp, 10) * 1000,
    ),
    estimateFeesForTx: async <T>(txObj: NonPayableTransactionObject<T>) => {
      try {
        const estimatedGas = await txObj.estimateGas();
        const feeEth = toBN(estimatedGas).mul(gasPriceBn);
        return {
          allowance: estimatedGas,
          gas: estimatedGas,
          feeEth,
          feeUsd: fromBNToDecimalString(feeEth.mul(ethUsdBn)),
        };
      } catch (err) {
        return { allowance: gasLimit };
      }
    },
  };
}
