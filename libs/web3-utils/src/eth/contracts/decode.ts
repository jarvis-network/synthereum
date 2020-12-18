import { BaseContract } from './typechain/types';
const abiDecoder = require('abi-decoder');

type MethodDecodeResult<C extends BaseContract> = {
  name: keyof C['methods'];
  params: { name: string; value: any; type: string }[];
};

export function decodeMethod<C extends BaseContract>(
  contract: C,
  input: string,
): MethodDecodeResult<C> {
  abiDecoder.addABI(contract.options.jsonInterface);
  return abiDecoder.decodeMethod(input) as typeof contract['methods'];
}
