import { sol2tsCodeGen } from './sol2ts-code-gen';

describe('sol2tsCodeGen', () => {
  it('should work', () => {
    expect(sol2tsCodeGen()).toEqual('sol2ts-code-gen');
  });
});
