import { useEffect, useRef } from 'react';
import { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import {
  SupportedNetworkId,
  SupportedNetworkName,
  isSupportedNetwork,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { loadRealm } from '@jarvis-network/synthereum-ts/dist/core/load-realm';
import { RealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realm-agent';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

import {
  PoolsForVersion,
  PoolVersion,
} from '@jarvis-network/synthereum-ts/dist/core/types/pools';
import type { BehaviorSubject } from 'rxjs';
import type Web3 from 'web3';

const poolVersion = (process.env.NEXT_PUBLIC_POOL_VERSION ||
  'v4') as PoolVersion;

export function useRealmAgentProvider(
  store: {
    getState(): { auth: { address: string } | null };
    subscribe(callback: () => void): () => void;
  },
  {
    web3$,
    networkId$,
    realmAgent$,
  }: {
    web3$: BehaviorSubject<Web3 | null>;
    networkId$: BehaviorSubject<number>;
    realmAgent$: BehaviorSubject<RealmAgent | null>;
  },
): void {
  const poolsRef = useRef<
    {
      [key in SupportedNetworkId]?: PoolsForVersion<
        typeof poolVersion,
        SupportedNetworkName
      >;
    }
  >({});
  const web3Ref = useRef(web3$.value);
  const networkIdRef = useRef(networkId$.value);
  const addressRef = useRef('');
  function provide(canceledRef: { canceled: boolean }, tries = 1) {
    const web3 = web3Ref.current;
    const networkId = networkIdRef.current;
    const address = addressRef.current;

    if (!web3 || !address || !isSupportedNetwork(networkId)) {
      realmAgent$.next(null);
      return;
    }

    loadRealm(web3 as Web3On<SupportedNetworkName>, networkId, {
      [poolVersion]: poolsRef.current[networkId] || null,
    })
      .then(realm => {
        if (canceledRef.canceled) return;
        poolsRef.current[networkId] = assertNotNull(
          realm.pools[poolVersion],
          'realm.pools[poolVersion] is null',
        );
        realmAgent$.next(
          new RealmAgent(
            realm,
            address as AddressOn<SupportedNetworkName>,
            poolVersion,
          ),
        );
      })
      .catch(reason => {
        if (canceledRef.canceled) return;
        // TODO: Try to fix after changing to web3-react. Throws when the network is being changed while loadRealm is running.
        if (tries === 5) throw reason;
        setTimeout(() => {
          if (canceledRef.canceled) return;
          provide(canceledRef, tries + 1);
        }, 100);
      });
  }

  useEffect(() => {
    const canceledRef = { canceled: false };
    provide(canceledRef);

    const web3$subscription = web3$.subscribe(value => {
      web3Ref.current = value;
      provide(canceledRef);
    });

    const networkId$subscription = networkId$.subscribe(value => {
      networkIdRef.current = value;
      provide(canceledRef);
    });

    const unsubscribe = store.subscribe(() => {
      const address = store.getState().auth?.address || '';
      if (addressRef.current === address) return;
      addressRef.current = address;
      provide(canceledRef);
    });

    return () => {
      web3$subscription.unsubscribe();
      networkId$subscription.unsubscribe();
      unsubscribe();
      canceledRef.canceled = true;
    };
  }, [web3$, networkId$, store]);
}
