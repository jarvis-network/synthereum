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

type Empty = null | undefined;

export function filterEmpty<T>(array: (T | Empty)[]): T[] {
  return array.filter(x => x !== null && x !== void 0) as T[];
}
