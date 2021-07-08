import { Transaction } from '@/data/transactions';
import {
  openDB,
  DBSchema,
  IDBPDatabase,
  StoreNames,
  IDBPTransaction,
} from 'idb';

export interface Schema extends DBSchema {
  transactions: {
    value: Transaction;
    key: string;
  };
}

interface IDBTransactionOptions {
  durability?: 'default' | 'strict' | 'relaxed';
}
// eslint-disable-next-line @typescript-eslint/no-shadow
function fakeDBFactory<Schema extends DBSchema>() {
  /**
   * Start a new transaction.
   *
   * @param storeNames The object store(s) this transaction needs.
   * @param mode
   * @param options
   */
  function transaction<
    Name extends StoreNames<Schema>,
    Mode extends IDBTransactionMode = 'readonly'
  >(
    _store: Name,
    mode?: Mode,
    _options?: IDBTransactionOptions,
  ): IDBPTransaction<Schema, [Name], Mode> {
    return {
      done: Promise.resolve(),
      store: ({
        add: mode === 'readonly' || !mode ? undefined : () => Promise.resolve(),
        getAll: () => Promise.resolve([]),
      } as unknown) as IDBPTransaction<Schema, [Name], Mode>['store'],
    } as IDBPTransaction<Schema, [Name], Mode>;
  }
  return Promise.resolve({
    transaction,
  });
}

type PromiseResolveType<T> = T extends Promise<infer R> ? R : never;
const fakeDBHelperVariable = (process.env.NODE_ENV === 'test'
  ? fakeDBFactory<Schema>()
  : undefined)!;
type FakeDB = PromiseResolveType<typeof fakeDBHelperVariable>;

export type DB = IDBPDatabase<Schema> | FakeDB;
export const dbPromise: Promise<DB> =
  typeof window === 'undefined'
    ? fakeDBFactory<Schema>()
    : openDB<Schema>('jarvis', 2, {
        upgrade(db) {
          db.createObjectStore('transactions', {
            keyPath: 'hash',
          });
        },
      });
