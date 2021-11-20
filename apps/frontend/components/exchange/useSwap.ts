import { wei } from '@jarvis-network/core-utils/dist/base/big-number';
import { useExchangeValues } from '@/utils/useExchangeValues';
import { PRIMARY_STABLE_COIN } from '@/data/assets';
import {
  useBehaviorSubject,
  useCoreObservables,
  useTransactionSpeedContext,
} from '@jarvis-network/app-toolkit';
import { SupportedSynthereumSymbol } from '@jarvis-network/synthereum-config';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { TransactionSpeed } from '@/state/initialState';

export const useSwap = () => {
  const agent = useBehaviorSubject(useCoreObservables().synthereumRealmAgent$);
  const {
    paySymbol,
    payValue,
    receiveSymbol,
    receiveValue,
    transactionCollateral,
  } = useExchangeValues();

  const { transactionSpeed } = useReduxSelector(state => ({
    transactionSpeed: state.exchange.transactionSpeed,
  }));

  const transactionSpeedContext = useTransactionSpeedContext();

  if (!agent || paySymbol === receiveSymbol) {
    // symbols should never be the same, but just in case..
    return null;
  }

  if (paySymbol === PRIMARY_STABLE_COIN.symbol) {
    // mint
    return () => {
      const collateral = wei(transactionCollateral!.bn.toString(10));
      const outputAmount = wei(receiveValue!.bn.toString(10));
      const outputSynth = receiveSymbol as SupportedSynthereumSymbol;

      console.log({
        collateral: collateral.toString(10),
        outputAmount: outputAmount.toString(10),
        outputSynth,
      });

      const { allowancePromise, txPromise, sendTx } = agent.mint({
        collateral,
        outputAmount,
        outputSynth,
        txOptions: {
          gasPrice: calculateGasPrice(
            transactionSpeedContext,
            transactionSpeed,
          ),
        },
      });

      txPromise.then(result => console.log('Minted!', result));

      return { allowancePromise, txPromise, sendTx };
    };
  }
  if (receiveSymbol === PRIMARY_STABLE_COIN.symbol) {
    // redeem
    return () => {
      const collateral = wei(transactionCollateral!.bn.toString(10));
      const inputAmount = wei(payValue!.bn.toString(10));
      const inputSynth = paySymbol as SupportedSynthereumSymbol;

      console.log({
        collateral: collateral.toString(10),
        inputAmount: inputAmount.toString(10),
        inputSynth,
      });

      const { allowancePromise, txPromise, sendTx } = agent.redeem({
        collateral,
        inputAmount,
        inputSynth,
        txOptions: {
          gasPrice: calculateGasPrice(
            transactionSpeedContext,
            transactionSpeed,
          ),
        },
      });

      txPromise.then(result => console.log('Redeem!', result));

      return { allowancePromise, txPromise, sendTx };
    };
  }
  // else: exchange

  return () => {
    const collateral = wei(transactionCollateral!.bn.toString(10));
    const inputAmount = wei(payValue!.bn.toString(10));
    const inputSynth = paySymbol as SupportedSynthereumSymbol;
    const outputAmount = wei(receiveValue!.bn.toString(10));
    const outputSynth = receiveSymbol as SupportedSynthereumSymbol;

    console.log({
      collateral: collateral.toString(10),

      inputAmount: inputAmount.toString(10),
      inputSynth,

      outputAmount: outputAmount.toString(10),
      outputSynth,
    });

    const { allowancePromise, txPromise, sendTx } = agent.exchange({
      collateral,
      inputAmount,
      inputSynth,
      outputAmount,
      outputSynth,
      txOptions: {
        gasPrice: calculateGasPrice(transactionSpeedContext, transactionSpeed),
      },
    });

    txPromise.then(result => console.log('Exchange!', result));

    return { allowancePromise, txPromise, sendTx };
  };
};

const oneGwei = FPN.fromWei(1000_000_000);
function calculateGasPrice(
  transactionSpeedContext: ReturnType<typeof useTransactionSpeedContext>,
  transactionSpeed: TransactionSpeed,
): string | undefined {
  return transactionSpeedContext.current
    ? oneGwei
        .mul(new FPN(transactionSpeedContext.current[transactionSpeed]))
        .toString(10)
    : undefined;
}
