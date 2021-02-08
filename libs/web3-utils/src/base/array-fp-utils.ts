export function mapReduce<T, U, R>(
  array: readonly T[],
  initialValue: R,
  mapFn: (elem: T) => U,
  reduceFn: (curr: R, next: U) => R,
) {
  return array.reduce(
    (curr, next) => reduceFn(curr, mapFn(next)),
    initialValue,
  );
}

export function unique<T = any>(array: readonly T[]): T[] {
  return [...new Set(array)];
}

export function first<T = any>(array: readonly T[]): T {
  return array[0];
}

export function last<T = any>(array: readonly T[]): T {
  return array[array.length - 1];
}

export function indexOfMaxValue(array: readonly number[]): number {
  return array.indexOf(Math.max(...array));
}

export function indexOfMaxLexicographicalValue(array: string[]): number {
  return array.indexOf(array.sort()[array.length - 1]);
}
