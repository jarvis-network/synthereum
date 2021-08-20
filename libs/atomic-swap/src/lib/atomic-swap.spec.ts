import { atomicSwap } from './atomic-swap';

describe('atomicSwap', () => {
  it('should work', () => {
    expect(atomicSwap()).toEqual('atomic-swap');
  });
});
