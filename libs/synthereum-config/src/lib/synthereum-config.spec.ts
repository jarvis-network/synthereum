import { synthereumConfig } from './synthereum-config';

describe('synthereumConfig', () => {
  it('should work', () => {
    expect(synthereumConfig()).toEqual('synthereum-config');
  });
});
