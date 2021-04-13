import { wei } from '@jarvis-network/core-utils/dist/base/big-number';
import { useExchangeValues } from '@/utils/useExchangeValues';
import { SyntheticSymbol } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { PRIMARY_STABLE_COIN } from '@/data/assets';
import {
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';

export const useSwap = () => {
  const agent = useBehaviorSubject(useCoreObservables().realmAgent$);
  const {
    paySymbol,
    payValue,
    receiveSymbol,
    receiveValue,
    transactionCollateral,
  } = useExchangeValues();

  if (!agent || paySymbol === receiveSymbol) {
    // symbols should never be the same, but just in case..
    return null;
  }

  if (paySymbol === PRIMARY_STABLE_COIN.symbol) {
    // mint
    return () => {
      const collateral = wei(transactionCollateral!.bn.toString(10));
      const outputAmount = wei(receiveValue!.bn.toString(10));
      const outputSynth = receiveSymbol as SyntheticSymbol;

      console.log({
        collateral: collateral.toString(10),
        outputAmount: outputAmount.toString(10),
        outputSynth,
      });

      const { allowancePromise, txPromise, sendTx } = agent.mint({
        collateral,
        outputAmount,
        outputSynth,
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
      const inputSynth = paySymbol as SyntheticSymbol;

      console.log({
        collateral: collateral.toString(10),
        inputAmount: inputAmount.toString(10),
        inputSynth,
      });

      const { allowancePromise, txPromise, sendTx } = agent.redeem({
        collateral,
        inputAmount,
        inputSynth,
      });

      txPromise.then(result => console.log('Redeem!', result));

      return { allowancePromise, txPromise, sendTx };
    };
  }
  // else: exchange

  return () => {
    const collateral = wei(transactionCollateral!.bn.toString(10));
    const inputAmount = wei(payValue!.bn.toString(10));
    const inputSynth = paySymbol as SyntheticSymbol;
    const outputAmount = wei(receiveValue!.bn.toString(10));
    const outputSynth = receiveSymbol as SyntheticSymbol;

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
    });

    txPromise.then(result => console.log('Exchange!', result));

    return { allowancePromise, txPromise, sendTx };
  };
};
