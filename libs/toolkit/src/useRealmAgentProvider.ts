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
import { PoolsForVersion } from '@jarvis-network/synthereum-ts/dist/core/types/pools';
import type { BehaviorSubject } from 'rxjs';
import { PoolVersion } from '@jarvis-network/synthereum-ts/dist/config';

import { useWeb3 } from './auth/useWeb3';

export function useRealmAgentProvider(
  poolVersion: PoolVersion,
  {
    realmAgent$,
  }: {
    realmAgent$: BehaviorSubject<RealmAgent | null>;
  },
): void {
  const poolsRef = useRef<
    {
      [key in SupportedNetworkId]?: PoolsForVersion<
        PoolVersion,
        SupportedNetworkName
      >;
    }
  >({});

  const { account: address, chainId: networkId, library: web3 } = useWeb3();

  useEffect(() => {
    let canceled = false;

    if (!web3 || !address || !isSupportedNetwork(networkId)) {
      realmAgent$.next(null);
      return;
    }

    loadRealm(web3 as Web3On<SupportedNetworkName>, networkId, {
      [poolVersion]: poolsRef.current[networkId] || null,
    }).then(realm => {
      if (canceled) return;
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
    });

    return () => {
      canceled = true;
      realmAgent$.next(null);
    };
  }, [poolVersion, realmAgent$, address, web3, networkId]);
}
