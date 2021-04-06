/**
 * Returns a promise which is resolved after the specified number of
 * `milliseconds` pass.
 * @param milliseconds The amount of milliseconds to delay the execution of the
 * current async function.
 */
export function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

type MapToPromiseFunctions<T> = { [P in keyof T]: () => Promise<T[P]> };

export async function executeInSequence<Args extends unknown[]>(
  ...promises: MapToPromiseFunctions<Args>
): Promise<Args> {
  const result: Args = ([] as unknown) as Args;
  for (const p of promises) {
    // eslint-disable-next-line no-await-in-loop
    result.push(await p());
  }
  return result;
}

export async function nullOnFailure<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    return null;
  }
}
