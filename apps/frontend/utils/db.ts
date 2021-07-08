import { SynthereumTransaction } from '@/data/transactions';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import { NetworkId } from '@jarvis-network/core-utils/dist/eth/networks';
import {
  openDB,
  DBSchema,
  IDBPDatabase,
  StoreNames,
  IDBPTransaction,
  IndexNames,
  IndexKey,
  StoreValue,
} from 'idb';

export interface Schema extends DBSchema {
  transactions: {
    value: SynthereumTransaction;
    key: string;
    indexes: {
      'networkId, from': [NetworkId, Address];
    };
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

  /**
   * Retrieves all values in an index that match the query.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param indexName Name of the index within the store.
   * @param query
   * @param count Maximum number of values to return.
   */
  function getAllFromIndex<
    Name extends StoreNames<Schema>,
    IndexName extends IndexNames<Schema, Name>
  >(
    _storeName: Name,
    _indexName: IndexName,
    _query?: IndexKey<Schema, Name, IndexName> | IDBKeyRange | null,
    _count?: number,
  ): Promise<StoreValue<Schema, Name>[]> {
    return Promise.resolve([]);
  }
  return Promise.resolve({
    transaction,
    getAllFromIndex,
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
          const transactions = db.createObjectStore('transactions', {
            keyPath: 'hash',
          });
          transactions.createIndex('networkId, from', ['networkId', 'from']);
        },
      });
