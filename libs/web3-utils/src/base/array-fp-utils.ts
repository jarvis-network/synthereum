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

/**
 * Checks if `array` includes `element`.
 * @param array Array to search in
 * @param element Element to search for and return if present
 */
export function includes<T>(
  array: readonly T[],
  element: unknown,
): element is T {
  return array.includes(element as any);
}

export function isSumLessThanOrEqualTo<T>(
  array: T[],
  mapItemToNumber: (item: T) => number,
  max: number,
) {
  return (
    accumulateUntil(
      array,
      0,
      (result, next) => result + mapItemToNumber(next),
      result => result <= max,
    ) <= max
  );
}

export type Iteration<State, Next, Result = State> = (
  state: State,
  next: Next,
) => Result;

export function accumulateUntil<Elem, Result>(
  array: Elem[],
  initialState: Result,
  combine: Iteration<Result, Elem>,
  shouldContinue: (state: Result) => boolean,
) {
  let state = initialState;
  for (let i = 0; i < array.length; i++) {
    state = combine(state, array[i]);
    if (!shouldContinue(state)) break;
  }
  return state;
}
