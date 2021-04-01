import { sortedUniqBy } from 'lodash';

import { assert } from './asserts';

type AsyncBinarySearchParams = {
  isLessThanAt: (idx: number) => Promise<boolean>;
  getStartIndex: () => Promise<number>;
  getEndIndex: () => Promise<number>;
};

/**
 * Returns an index pointing to the first element in the range
 * `[startIndex, endIndex)` that is not less than, as determined by the
 * `isLessThanAt` function, or `endIndex` if no such element is found.
 *
 * In contrast with the classical implementation of this algorithm, this
 * function in async, as it doesn't require that all the data exists
 * beforehand. Instead the following parameters:
 *
 * * `isLessThanAt: (idx: number) => Promise<boolean>`
 * * `getStartIndex: () => Promise<number>`
 * * `getEndIndex: () => Promise<number>`
 *
 * allow lazy fetching of the needed data on demand.
 */
export async function asyncLowerBound({
  isLessThanAt,
  getStartIndex,
  getEndIndex,
}: AsyncBinarySearchParams): Promise<number> {
  const [lo_, hi] = await Promise.all([getStartIndex(), getEndIndex()]);
  let lo = lo_;
  let len = hi - lo;
  while (len > 0) {
    const step = len >> 1;
    const mid = lo + step;
    // eslint-disable-next-line no-await-in-loop
    if (await isLessThanAt(mid)) {
      lo = mid + 1;
      len -= step + 1;
    } else len = step;
  }
  return lo;
}

export type CompareFunction<T> = (a: T, b: T) => number;
export type LeftOuterJoinMapFunction<T, U> = (a: T, b: T | null) => U;
export type MaybeSortedArray<T, K extends number | string> =
  | T[]
  | SortedArray<T, K>;

export class SortedArray<T, K extends number | string> {
  // https://github.com/typescript-eslint/typescript-eslint/issues/2592
  // eslint-disable-next-line @typescript-eslint/no-shadow
  static createFromUnsorted<T, K extends number | string>(
    array: T[],
    cmp: CompareFunction<T>,
    key: (x: T) => K,
  ): SortedArray<T, K> {
    return new SortedArray<T, K>(array.sort(cmp), cmp, key);
  }

  // https://github.com/typescript-eslint/typescript-eslint/issues/2592
  // eslint-disable-next-line @typescript-eslint/no-shadow
  static createFromSortedUnsafe<T, K extends number | string>(
    array: T[],
    cmp: CompareFunction<T>,
    key: (x: T) => K,
  ): SortedArray<T, K> {
    return new SortedArray<T, K>(array, cmp, key);
  }

  private constructor(
    public readonly array: T[],
    public readonly cmp: CompareFunction<T>,
    public readonly key: (x: T) => K,
  ) {}

  get length(): number {
    return this.array.length;
  }

  uniq(): SortedArray<T, K> {
    return new SortedArray<T, K>(
      sortedUniqBy(this.array, this.key),
      this.cmp,
      this.key,
    );
  }

  closestValue(to: number) {
    const lowerBound = this.lowerBound(to);
    if (lowerBound === 0) return 0;

    if (lowerBound >= this.array.length) return this.array.length - 1;

    const before = this.key(this.array[lowerBound - 1]) as number;
    const at = this.key(this.array[lowerBound]) as number;

    return Math.abs(to - at) < Math.abs(to - before)
      ? lowerBound
      : lowerBound - 1;
  }

  lowerBound(key: number, first = 0, last = this.array.length) {
    let count = last - first;
    while (count > 0) {
      const step = count >> 1;
      let it = first + step;
      if (this.key(this.array[it]) < key) {
        first = ++it;
        count -= step + 1;
      } else count = step;
    }
    return first;
  }

  upperBound(key: number, first = 0, last = this.array.length) {
    let count = last - first;
    while (count > 0) {
      const step = count >> 1;
      let it = first + step;
      if (key < this.key(this.array[it])) {
        count = step;
      } else {
        first = ++it;
        count -= step + 1;
      }
    }
    return first;
  }

  // Performs left outer join on two sorted arrays (`this` as the left one and `right`),
  // containing unique keys, ordered according to `this.cmp`.
  leftOuterJoin<R extends T>(
    right_: SortedArray<T, K>,
    mapFn: LeftOuterJoinMapFunction<T, R>,
  ): {
    result: SortedArray<R, K>;
    leftOver: SortedArray<T, K>;
  } {
    assert(this.cmp === right_.cmp);
    const left = this.array;
    const right = right_.array;
    const { cmp } = this;
    const union: R[] = [];
    const leftOver: T[] = [];
    for (let i = 0, j = 0; i < left.length && j < right.length; ) {
      let res = cmp(left[i], right[j]);
      if (res === 0) {
        union.push(mapFn(left[i++], right[j++]));
      } else if (res < 0) {
        union.push(mapFn(left[i++], null));
      } else {
        for (; j < right.length; j++) {
          res = cmp(left[i], right[j]);
          if (res <= 0) break;
          leftOver.push(right[j]);
        }
        union.push(mapFn(left[i++], res === 0 ? right[j++] : null));
      }
    }
    return {
      result: new SortedArray<R, K>(union, cmp, this.key),
      leftOver: new SortedArray<T, K>(leftOver, cmp, right_.key),
    };
  }
}

export function assertSorted<
  T,
  K extends number | string,
  CMP extends CompareFunction<T>
>(
  array: MaybeSortedArray<T, K>,
  cmp: CMP,
  key: (x: T) => K,
): SortedArray<T, K> {
  assert(isSorted(array, cmp));
  return Array.isArray(array)
    ? SortedArray.createFromSortedUnsafe<T, K>(array, cmp, key)
    : array;
}

export function isSorted<
  T,
  K extends number | string,
  CMP extends CompareFunction<T>
>(array: MaybeSortedArray<T, K>, cmp: CMP): boolean {
  if (!Array.isArray(array)) {
    return array.cmp === cmp;
  }
  for (let i = 0; i < array.length - 1; ++i)
    if (cmp(array[i], array[i + 1]) > 0) return false;
  return true;
}
