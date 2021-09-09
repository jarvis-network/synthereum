import { Asset, AssetPair } from '@/data/assets';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

export const createPairs = (
  list: Asset[],
  prices: Record<string, FPN>,
): AssetPair[] =>
  list
    .reduce<AssetPair[]>((result, input) => {
      result.push(
        ...list.reduce<AssetPair[]>((innerResult, output) => {
          if (output === input) {
            return innerResult;
          }
          const name = `${input.symbol}/${output.symbol}`;
          innerResult.push({
            input,
            output,
            name,
            inputPrice: input.collateral
              ? FPN.ONE
              : input.pair && prices[input.pair],
            outputPrice: output.collateral
              ? FPN.ONE
              : output.pair && prices[output.pair],
          });
          return innerResult;
        }, []),
      );
      return result;
    }, [])
    .filter(pair => pair.input.synthetic || pair.output.synthetic)
    .filter(
      pair => pair.input.symbol !== 'WETH' && pair.output.symbol !== 'WETH',
    );
