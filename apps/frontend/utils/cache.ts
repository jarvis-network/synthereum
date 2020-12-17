import { Store, set, get } from 'idb-keyval';

class Cache {
  store: Store;

  constructor() {
    this.store = new Store('jarvis', 'exchange');
  }

  set<T = any>(key: string, value: T) {
    return set(key, value, this.store);
  }

  get<T = any>(key: string) {
    return get<T>(key, this.store);
  }
}

export const cache = typeof window === 'undefined' ? null : new Cache();
