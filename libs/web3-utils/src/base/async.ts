/**
 * Returns a promise which is resolved after the specified number of
 * `miliseconds` pass.
 * @param miliseconds The amount of miliseconds to delay the execution of the
 * current async function.
 */
export function delay(miliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, miliseconds));
}
