const cacheObj = {
  set<T = any>(key: string, value: T) {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  },

  get<T = any>(key: string) {
    if (typeof window === 'undefined') {
      return null;
    }
    return JSON.parse(localStorage.getItem(key)!) as T | null;
  },
};

export const cache = cacheObj;
