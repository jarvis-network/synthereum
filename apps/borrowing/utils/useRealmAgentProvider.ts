import { useEffect, useRef } from 'react';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { RealmAgent } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';

import {
  PoolsForVersion,
  PoolVersion,
} from '@jarvis-network/synthereum-contracts/dist/src/core/types/pools';
import type { BehaviorSubject } from 'rxjs';
import type Web3 from 'web3';
import { useStore } from '@/state/store';

import { NETWORK_ID } from './environment';

const poolVersion = (process.env.NEXT_PUBLIC_POOL_VERSION ||
  'v1') as PoolVersion;

export function useRealmAgentProvider(
  store: ReturnType<typeof useStore>,
  web3$: BehaviorSubject<Web3 | null>,
  realmAgent$: BehaviorSubject<RealmAgent | null>,
) {
  const poolsRef = useRef<PoolsForVersion<
    typeof poolVersion,
    SupportedNetworkName
  > | null>(null);
  const web3Ref = useRef(web3$.value);
  const addressRef = useRef(store.getState().auth?.address);
  function provide() {
    const web3 = web3Ref.current;
    const address = addressRef.current;

    if (!web3 || !address) {
      realmAgent$.next(null);
      return;
    }

    loadRealm(web3 as Web3On<SupportedNetworkName>, NETWORK_ID, {
      [poolVersion]: poolsRef.current,
    }).then(realm => {
      poolsRef.current = realm.pools[poolVersion]!;
      realmAgent$.next(
        new RealmAgent(
          realm,
          address as AddressOn<typeof NETWORK_ID>,
          poolVersion,
        ),
      );
    });
  }

  useEffect(() => {
    provide();

    const web3$subscription = web3$.subscribe(value => {
      web3Ref.current = value;
      provide();
    });

    const unsubscribe = store.subscribe(() => {
      const address = store.getState().auth?.address;
      if (addressRef.current === address) return;
      addressRef.current = address;
      provide();
    });

    return () => {
      web3$subscription.unsubscribe();
      unsubscribe();
    };
  }, [web3$, store]);
}
