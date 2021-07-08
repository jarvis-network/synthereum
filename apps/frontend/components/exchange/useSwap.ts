import { weiFromFPN } from '@jarvis-network/core-utils/dist/base/big-number';
import { useExchangeValues } from '@/utils/useExchangeValues';
import { SyntheticSymbol } from '@jarvis-network/synthereum-ts/dist/config';
import { PRIMARY_STABLE_COIN } from '@/data/assets';
import {
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';
import { SynthereumTransactionType } from '@/data/transactions';

const noop = () => undefined;

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
      const collateral = weiFromFPN(payValue!);
      const outputAmount = weiFromFPN(receiveValue!);
      const outputSynth = receiveSymbol as SyntheticSymbol;
      const { allowancePromise, txPromise, sendTx } = agent.mint({
        collateral,
        outputAmount,
        outputSynth,
      });

      txPromise.then(result => console.log('Mint!', result)).catch(noop);

      return {
        allowancePromise,
        txPromise,
        sendTx,
        payValue: collateral.toString(),
        paySymbol: paySymbol as SyntheticSymbol,
        receiveValue: outputAmount.toString(),
        receiveSymbol: outputSynth,
        type: 'mint' as SynthereumTransactionType,
        networkId: agent.realm.netId,
      };
    };
  }
  if (receiveSymbol === PRIMARY_STABLE_COIN.symbol) {
    // redeem
    return () => {
      const collateral = weiFromFPN(receiveValue!);
      const inputAmount = weiFromFPN(payValue!);
      const inputSynth = paySymbol as SyntheticSymbol;
      const { allowancePromise, txPromise, sendTx } = agent.redeem({
        collateral,
        inputAmount,
        inputSynth,
      });

      txPromise.then(result => console.log('Redeem!', result)).catch(noop);

      return {
        allowancePromise,
        txPromise,
        sendTx,
        payValue: inputAmount.toString(),
        paySymbol: inputSynth,
        receiveValue: collateral.toString(),
        receiveSymbol: receiveSymbol as SyntheticSymbol,
        type: 'redeem' as SynthereumTransactionType,
        networkId: agent.realm.netId,
      };
    };
  }
  return () => {
    const inputAmount = weiFromFPN(payValue!);
    const inputSynth = paySymbol as SyntheticSymbol;
    const outputAmount = weiFromFPN(receiveValue!);
    const outputSynth = receiveSymbol as SyntheticSymbol;
    const { allowancePromise, txPromise, sendTx } = agent.exchange({
      inputAmount,
      inputSynth,
      outputAmount,
      outputSynth,
    });

    txPromise.then(result => console.log('Exchange!', result)).catch(noop);

    return {
      allowancePromise,
      txPromise,
      sendTx,
      payValue: inputAmount.toString(),
      paySymbol: inputSynth,
      receiveValue: outputAmount.toString(),
      receiveSymbol: outputSynth,
      type: 'exchange' as SynthereumTransactionType,
      networkId: agent.realm.netId,
    };
  };
};
