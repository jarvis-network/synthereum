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
import type { BehaviorSubject } from 'rxjs';
import { PoolVersion } from '@jarvis-network/synthereum-ts/dist/config';
import {
  SerializablePools,
  getSerializablePoolsFromRealm,
} from '@jarvis-network/synthereum-ts/dist/core/realm-utils';
import { ToNetworkName } from '@jarvis-network/core-utils/dist/eth/networks';

import { useWeb3 } from './auth/useWeb3';

export function useRealmAgentProvider(
  poolVersion: PoolVersion,
  {
    realmAgent$,
  }: {
    realmAgent$: BehaviorSubject<RealmAgent | null>;
  },
  staticProps?: {
    [Pool in PoolVersion]?: {
      [NetworkId in SupportedNetworkId]?: SerializablePools<
        ToNetworkName<NetworkId>,
        Pool
      >;
    };
  },
): void {
  const poolsRef = useRef<
    {
      [NetworkId in SupportedNetworkId]?: SerializablePools<
        ToNetworkName<NetworkId>,
        PoolVersion
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

    const staticPropsPools = staticProps?.[poolVersion]?.[networkId];
    loadRealm(web3 as Web3On<SupportedNetworkName>, networkId, {
      [poolVersion]: staticPropsPools || poolsRef.current[networkId] || null,
    }).then(realm => {
      if (canceled) return;
      assertNotNull(
        realm.pools[poolVersion],
        'realm.pools[poolVersion] is null',
      );
      poolsRef.current[networkId as 42] = getSerializablePoolsFromRealm(
        realm,
        poolVersion,
      ) as SerializablePools<'kovan', PoolVersion>;
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
  }, [poolVersion, realmAgent$, address, web3, networkId, staticProps]);

  if (process.env.NODE_ENV === 'development') {
    const ref = useRef(true);
    useEffect(() => {
      if (ref.current) {
        ref.current = false;
        return;
      }
      throw new Error('Updates of poolVersion not supported');
    }, [poolVersion]);
  }
}
