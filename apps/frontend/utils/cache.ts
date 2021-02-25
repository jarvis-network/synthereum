const cacheObj = {
  set<T = any>(key: string, value: T) {
    return localStorage.setItem(key, JSON.stringify(value));
  },

  get<T = any>(key: string) {
    return JSON.parse(localStorage.getItem(key)!) as T | null;
  },
};

export const cache = typeof window === 'undefined' ? null : cacheObj;
