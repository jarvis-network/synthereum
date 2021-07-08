import { Middleware } from '@reduxjs/toolkit';
import { cache } from '@jarvis-network/app-toolkit';

const get = <
  T extends Record<string, unknown>,
  L extends keyof T,
  R extends string[]
>(
  source: T | null,
  path: [L, ...R],
): T | null => {
  if (!path.length) {
    return source;
  }
  if (source == null) {
    return source;
  }

  const parts = [...path] as [L, ...R];
  const current = parts.shift() as L;
  return get(source[current] as any, parts as any) as T;
};

export const createPersistMiddleware = <T extends Record<string, unknown>>(
  pathsToStore: string[],
) => {
  let lastState: T | null = null;
  const persistMiddleware: Middleware<
    Record<string, unknown>,
    T
  > = store => next => action => {
    const result = next(action);

    if (typeof window !== 'undefined') {
      const appState: T = store.getState();

      if (lastState) {
        pathsToStore.forEach(path => {
          const current = get(
            appState,
            path.split('.') as [keyof T, ...string[]],
          );
          const previous = get(
            lastState,
            path.split('.') as [keyof T, ...string[]],
          );
          if (current !== previous) {
            cache.set(`jarvis/state/${path}`, current);
          }
        });
      }

      lastState = appState;
    }

    return result;
  };

  return persistMiddleware;
};
