/**
 * Returns a promise which is resolved after the specified number of
 * `miliseconds` pass.
 * @param miliseconds The amount of miliseconds to delay the execution of the
 * current async function.
 */
export function delay(miliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, miliseconds));
}

type MapToPromiseFunctions<T> = { [P in keyof T]: () => Promise<T[P]> };

export async function executeInSequence<Args extends any[]>(
  ...promises: MapToPromiseFunctions<Args>
): Promise<Args> {
  const result: Args = ([] as unknown) as Args;
  for (const p of promises) {
    result.push(await p());
  }
  return result;
}

export async function nullOnFailure<T>(
  promise: Promise<T>,
): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    return null;
  }
}
