import { Middleware } from '@reduxjs/toolkit';
import { RootState } from '@/state/reducer';
import { cache } from '@/utils/cache';

let lastState: RootState | null = null;

const get = <T>(
  source: Record<string, unknown> | null,
  path: string[],
): T | null => {
  if (!path.length) {
    return source as T;
  }
  if (source == null) {
    return source;
  }

  const parts = [...path];
  const current = parts.shift();
  return get(source[current!] as Record<string, unknown>, parts) as T;
};

export const createPersistMiddleware = (pathsToStore: string[]) => {
  const persistMiddleware: Middleware = store => next => action => {
    const result = next(action);

    if (cache) {
      const appState: RootState = store.getState();

      if (lastState) {
        pathsToStore.forEach(path => {
          const current = get(appState, path.split('.'));
          const previous = get(lastState, path.split('.'));
          if (current !== previous) {
            cache!.set(`jarvis/state/${path}`, current);
          }
        });
      }

      lastState = appState;
    }

    return result;
  };

  return persistMiddleware;
};
