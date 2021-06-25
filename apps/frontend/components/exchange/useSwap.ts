import { wei } from '@jarvis-network/core-utils/dist/base/big-number';
import { useExchangeValues } from '@/utils/useExchangeValues';
import { SyntheticSymbol } from '@jarvis-network/synthereum-ts/dist/config';
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
  } = useExchangeValues();

  if (!agent || paySymbol === receiveSymbol) {
    // symbols should never be the same, but just in case..
    return null;
  }

  if (paySymbol === PRIMARY_STABLE_COIN.symbol) {
    // mint
    return () => {
      const { allowancePromise, txPromise, sendTx } = agent.mint({
        collateral: wei(payValue!.bn.toString(10)),
        outputAmount: wei(receiveValue!.bn.toString(10)),
        outputSynth: receiveSymbol as SyntheticSymbol,
      });

      txPromise.then(result => console.log('Minted!', result));

      return { allowancePromise, txPromise, sendTx };
    };
  }
  if (receiveSymbol === PRIMARY_STABLE_COIN.symbol) {
    // redeem
    return () => {
      const { allowancePromise, txPromise, sendTx } = agent.redeem({
        collateral: wei(receiveValue!.bn.toString(10)),
        inputAmount: wei(payValue!.bn.toString(10)),
        inputSynth: paySymbol as SyntheticSymbol,
      });

      txPromise.then(result => console.log('Redeem!', result));

      return { allowancePromise, txPromise, sendTx };
    };
  }
  return () => {
    const { allowancePromise, txPromise, sendTx } = agent.exchange({
      inputAmount: wei(payValue!.bn.toString(10)),
      inputSynth: paySymbol as SyntheticSymbol,
      outputAmount: wei(receiveValue!.bn.toString(10)),
      outputSynth: receiveSymbol as SyntheticSymbol,
    });

    txPromise.then(result => console.log('Exchange!', result));

    return { allowancePromise, txPromise, sendTx };
  };
};
