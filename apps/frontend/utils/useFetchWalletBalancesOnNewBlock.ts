import { useCallback, useEffect, useRef } from 'react';
import { Subscription } from 'web3-core-subscriptions';
import { BlockHeader } from 'web3-eth';
import { RealmAgent } from '@jarvis-network/synthereum-ts/dist/core/realm-agent';
import type { BehaviorSubject } from 'rxjs';
import { AnyAction, Dispatch } from 'redux';

import { fetchWalletBalances } from '@/state/slices/wallet';

type AbortablePromise = ReturnType<ReturnType<typeof fetchWalletBalances>>;

export function useFetchWalletBalancesOnNewBlock(
  dispatch: Dispatch,
  {
    realmAgent$,
  }: {
    realmAgent$: BehaviorSubject<RealmAgent | null>;
  },
): void {
  const realmAgentRef = useRef(realmAgent$.value);
  const lastRequestedBlockNumberRef = useRef(0);
  const lastPromiseRef = useRef<AbortablePromise | null>();
  const subscriptionRef = useRef<Subscription<BlockHeader> | null>(null);
  const setupSubscription = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;

    abortPromise();

    const realmAgent = realmAgentRef.current;

    if (!realmAgent) return;

    const callback = (blockNumber: number) => {
      if (blockNumber <= lastRequestedBlockNumberRef.current) return;

      lastRequestedBlockNumberRef.current = blockNumber;

      abortPromise();

      lastPromiseRef.current = (dispatch(
        (fetchWalletBalances(realmAgent) as unknown) as AnyAction,
      ) as unknown) as AbortablePromise;
    };

    subscriptionRef.current = realmAgent.realm.web3.eth
      .subscribe('newBlockHeaders')
      .on('data', blockHeader => {
        callback(blockHeader.number);
      })
      // eslint-disable-next-line no-console
      .on('error', console.error);

    callback(1); // Fetch before new block

    function abortPromise() {
      lastPromiseRef.current?.abort();
      lastPromiseRef.current = null;
    }
  }, [dispatch]);

  useEffect(() => {
    const realmAgent$subscription = realmAgent$.subscribe(realmAgent => {
      realmAgentRef.current = realmAgent;
      setupSubscription();
    });

    setupSubscription();

    return () => {
      realmAgent$subscription.unsubscribe();
      realmAgentRef.current = null;
      setupSubscription();
    };
  }, [realmAgent$, setupSubscription]);
}
