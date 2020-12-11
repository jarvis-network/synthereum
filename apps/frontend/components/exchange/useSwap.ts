import { useContext } from 'react';
import { RealmAgentContext } from '@/components/auth/AuthProvider';
import { wei } from '@jarvis-network/web3-utils/base/big-number';
import { useExchangeValues } from '@/utils/useExchangeValues';
import { SyntheticSymbol } from '@jarvis-network/synthereum-contracts/dist/src/config';

export const useSwap = () => {
  const agent = useContext(RealmAgentContext);
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

  if (paySymbol === 'USDC') {
    // mint
    return async () => {
      try {
        const collateral = wei(transactionCollateral!.bn.toString(10));
        const outputAmount = wei(receiveValue!.bn.toString(10));
        const outputSynth = receiveSymbol as SyntheticSymbol;

        console.log({
          collateral: collateral.toString(10),
          outputAmount: outputAmount.toString(10),
          outputSynth,
        });

        const result = await agent.mint({
          collateral,
          outputAmount,
          outputSynth,
        });
        console.log('Minted!', result);
      } catch (e) {
        console.error('Error while minting', e);
      }
    };
  }
  if (receiveSymbol === 'USDC') {
    // redeem
    return async () => {
      try {
        const collateral = wei(transactionCollateral!.bn.toString(10));
        const inputAmount = wei(payValue!.bn.toString(10));
        const inputSynth = paySymbol as SyntheticSymbol;

        console.log({
          collateral: collateral.toString(10),
          inputAmount: inputAmount.toString(10),
          inputSynth,
        });

        const result = await agent.redeem({
          collateral,
          inputAmount,
          inputSynth,
        });
        console.log('Redeem!', result);
      } catch (e) {
        console.error('Error while minting', e);
      }
    };
  }
  // else: exchange

  return async () => {
    try {
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

      const result = await agent.exchange({
        collateral,
        inputAmount,
        inputSynth,
        outputAmount,
        outputSynth,
      });
      console.log('exchange!', result);
    } catch (e) {
      console.error('Error while minting', e);
    }
  };
};
