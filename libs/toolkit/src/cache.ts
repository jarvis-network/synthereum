const cacheObj = {
  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  },

  get<T>(key: string): T | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return (JSON.parse as (string: string | null) => T | null)(
      localStorage.getItem(key),
    ) as T | null;
  },

  delete(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(key);
  },
};

export const cache = cacheObj;
