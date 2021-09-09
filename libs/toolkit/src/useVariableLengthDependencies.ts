import { uniqueId } from 'lodash';
import { useState } from 'react';

const transforms = {
  bigint: (bigint: bigint) => `bigint(${bigint})`,
  number: (number: number) => `number(${number})`,
  string: (string: string) => `string(${string})`,
  boolean: (boolean: boolean) => `boolean(${boolean})`,
  symbol: (symbol: symbol) => `symbol(${String(symbol)})`,
  undefined: (_undefined: undefined) => `undefined`,
} as const;

type Others = string | number | boolean | bigint | symbol | undefined;
export function useVariableLengthDependencies<
  R,
  T extends Record<string | number | symbol, R> = Record<
    string | number | symbol,
    R
  >,
  Z extends (T | Others | null)[] = (T | Others | null)[]
>(items?: Z): string {
  const [weakMap] = useState(() => new WeakMap<T, string>());

  return items
    ? items
        .map(item => {
          const type = typeof item;
          if (type !== 'object' && type !== 'function')
            return (transforms[type] as typeof transforms['bigint'])(
              item as bigint,
            );

          if (!item) return 'null';

          if (!weakMap.has(item as T)) {
            const id = uniqueId();
            weakMap.set(item as T, id);
            return id;
          }

          return weakMap.get(item as T);
        })
        .join()
    : '';
}
