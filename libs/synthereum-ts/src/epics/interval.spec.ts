/* eslint-disable */

import { dynamicInterval } from './interval';

describe('Check the interval', () => {
  it('Should run the interval', async done => {
    const testInterval = dynamicInterval();
    const intervalStream$ = testInterval.interval$;
    const subscription = intervalStream$.subscribe({
      next: v => expect(v).toEqual(0),
    });
    setTimeout(() => {
      subscription.unsubscribe();
      done();
    }, 2000);
  });
});
