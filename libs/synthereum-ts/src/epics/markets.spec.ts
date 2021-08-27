/* eslint-disable */
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-config';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import { BehaviorSubject, ReplaySubject } from 'rxjs';

import { Context, createContext } from './core';
import { Dependencies } from './types';
import { InputAction, marketEpic } from './markets';

describe('markets', () => {
  let context: Context;
  let deps: Dependencies = {
    context$: null,
  };
  beforeAll(async () => {
    const netId = parseSupportedNetworkId(1);
    const web3 = getInfuraWeb3(netId);
    context = await createContext(web3);
    deps = {
      context$: new BehaviorSubject<Context>(context),
    };
  });

  it('Should get pairs with gcr and cr', async done => {
    const action$ = new ReplaySubject<InputAction>(20);
    action$.next({ type: 'GET_MARKET_LIST' });

    const state$ = null;
    const priceFeedStream$ = marketEpic(action$, state$, deps);
    const feed = priceFeedStream$.subscribe({
      next: v => {
        console.log(v);
      },
    });
    setTimeout(() => {
      feed.unsubscribe();
      done();
    }, 10000);
  }, 10000);
});
