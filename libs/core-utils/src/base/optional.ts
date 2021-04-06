export function getOrCreateElement<T>(
  map: Map<string, T>,
  key: string,
  create: () => T,
): T {
  let result = map.get(key);
  if (!result) {
    result = create();
    map.set(key, result);
  }
  return result;
}

export async function getOrCreateElementAsync<T>(
  map: Map<string, T>,
  key: string,
  create: () => Promise<T>,
): Promise<T> {
  let result = map.get(key);
  if (!result) {
    result = await create();
    map.set(key, result);
  }
  return result;
}

export type Empty = null | undefined;

export function filterEmpty<T>(array: (T | Empty)[]): T[] {
  return array.filter(x => x !== null && x !== undefined) as T[];
}
