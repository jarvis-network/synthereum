/* eslint-disable */
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-config';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';

import { BehaviorSubject, ReplaySubject } from 'rxjs';

import { InputAction, priceFeedEpic, PriceFeedSymbols } from './price-feed';
import { Context, createContext } from './core';
import { Dependencies } from './types';

describe('price-feed epic', () => {
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

  it('Should get single pair jGBP/USDC', async done => {
    const action$ = new ReplaySubject<InputAction>(20);
    action$.next({ type: 'UPDATE_INTERVAL', payload: 1000 });
    action$.next({ payload: ['jGBP/USDC'], type: 'UPDATE_PAIRS' });
    const state$ = null;
    const priceFeedStream$ = priceFeedEpic(action$, state$, deps);
    const feed = priceFeedStream$.subscribe({
      next: v => {
        expect(v).toBeDefined();
      },
    });
    setTimeout(() => {
      feed.unsubscribe();
      done();
    }, 2000);
  }, 6000);

  it('Should get multiple pairs UMA, USDC, jGBP/UMA, jGBP/USDC', async done => {
    const action$ = new ReplaySubject<InputAction>(20);
    action$.next({ type: 'UPDATE_INTERVAL', payload: 1000 });
    action$.next({
      payload: ['UMA', 'jGBP/USDC', 'jGBP/UMA'],
      type: 'UPDATE_PAIRS',
    });
    const state$ = null;
    const priceFeedStream$ = priceFeedEpic(action$, state$, deps);
    const feed = priceFeedStream$.subscribe({
      next: v => {
        expect(v).toBeDefined();
        expect(Object.keys(v.payload!).sort()).toEqual(
          ['UMA', 'jGBP/USDC', 'jGBP/UMA'].sort(),
        );
      },
    });
    setTimeout(() => {
      feed.unsubscribe();
      done();
    }, 2000);
  }, 6000);

  it('Should switch between pairs jEUR/USDC, jGBP/UMA', async done => {
    const action$ = new ReplaySubject<InputAction>(20);
    let currentPair: PriceFeedSymbols[] = ['jEUR/USDC'];
    action$.next({ type: 'UPDATE_INTERVAL', payload: 1000 });
    action$.next({
      payload: currentPair,
      type: 'UPDATE_PAIRS',
    });
    const state$ = null;
    const priceFeedStream$ = priceFeedEpic(action$, state$, deps);
    const feed = priceFeedStream$.subscribe({
      next: v => {
        expect(v.payload![currentPair[0]]).toBeDefined();
      },
    });
    setTimeout(() => {
      currentPair = ['jGBP/UMA'];
      action$.next({
        payload: currentPair,
        type: 'UPDATE_PAIRS',
      });
    }, 3000);
    setTimeout(() => {
      feed.unsubscribe();
      done();
    }, 6000);
  }, 6000);
});
