import { Asset, AssetPair } from '@/data/assets';
import { ExchangeToken } from '@jarvis-network/synthereum-ts/dist/config';

const getRealSymbol = (symbol: ExchangeToken): string => {
  if (symbol === 'USDC') {
    return 'usd';
  }

  return symbol.substring(1);
};

export const createPairs = (list: Asset[]): AssetPair[] =>
  list.reduce<AssetPair[]>((result, input) => {
    result.push(
      ...list.reduce<AssetPair[]>((innerResult, output) => {
        if (output === input) {
          return innerResult;
        }
        const name = `${input.symbol}/${output.symbol}`;
        const realCurrenciesPair = `${getRealSymbol(
          input.symbol,
        )}${getRealSymbol(output.symbol)}`;
        const index = realCurrenciesPair;
        innerResult.push({ input, output, name, index });
        return innerResult;
      }, []),
    );
    return result;
  }, []);
