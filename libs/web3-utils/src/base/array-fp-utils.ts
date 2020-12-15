export function mapReduce<T, U, R>(
  array: T[],
  initialValue: R,
  mapFn: (elem: T) => U,
  reduceFn: (curr: R, next: U) => R,
) {
  return array.reduce(
    (curr, next) => reduceFn(curr, mapFn(next)),
    initialValue,
  );
}
