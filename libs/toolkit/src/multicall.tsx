import React, {
  ReactNode,
  useEffect,
  useMemo,
  createContext,
  useContext,
  useState,
} from 'react';
import { BehaviorSubject } from 'rxjs';
import {
  ContractCallContext,
  ContractCallResults,
  Multicall,
} from 'ethereum-multicall';
import { BaseContract } from '@jarvis-network/core-utils/dist/eth/contracts/typechain/types';
import { AbiItem } from 'ethereum-multicall/dist/esm/models';
import { debounce, isEqual, uniqueId } from 'lodash';

import { useCoreObservables } from './CoreObservablesContext';
import { useBlockNumber$Context } from './BlockNumber$Context';
import { useBehaviorSubject } from './useBehaviorSubject';
import { useVariableLengthDependencies } from './useVariableLengthDependencies';
import { Falsy } from './types';
import { useWeb3 } from './auth/useWeb3';

type Call = Omit<ContractCallContext, 'reference' | 'context'>;

class Context {
  private callsMap: Record<string, ContractCallContext> = {};

  private sameCalls: Record<string, string> = {};

  calls$ = new BehaviorSubject<{
    calls: ContractCallContext[];
    sameCalls: Record<string, string>;
  }>({ calls: [], sameCalls: {} });

  lastResults$ = new BehaviorSubject<ContractCallResults>({
    results: {},
    blockNumber: 0,
  });

  private updateItemsLength = debounce(() => {
    this.calls$.next({
      calls: Object.values(this.callsMap),
      sameCalls: { ...this.sameCalls },
    });
  }, 0);

  add(value: Call) {
    for (const i in this.callsMap) {
      if (!Object.prototype.hasOwnProperty.call(this.callsMap, i)) continue;

      const call = this.callsMap[i];
      if (
        call.abi === value.abi &&
        call.contractAddress === value.contractAddress &&
        isEqual(call.calls, value.calls)
      ) {
        const key = uniqueId();
        const { reference } = call;
        this.sameCalls[key] = reference;
        const { results, blockNumber } = this.lastResults$.value;
        const search = results[reference];
        if (search) {
          this.lastResults$.next({
            results: { ...results, [key]: search },
            blockNumber,
          });
        }
        return key;
      }
    }

    const key = uniqueId();
    const fixedValue = { ...value, reference: key };
    this.callsMap[key] = fixedValue;
    this.updateItemsLength();
    return key;
  }

  remove(key: string) {
    const call = this.callsMap[key];
    if (call) {
      let newKey: string | undefined;
      for (const i in this.sameCalls) {
        if (!Object.prototype.hasOwnProperty.call(this.sameCalls, i)) continue;

        const c = this.sameCalls[i];
        if (c === key) {
          if (newKey) {
            this.sameCalls[i] = newKey;
          } else {
            this.callsMap[i] = call;
            call.reference = i;
            delete this.sameCalls[i];
            newKey = i;
          }
        }
      }
      delete this.callsMap[key];
    } else {
      delete this.sameCalls[key];
    }
    this.updateItemsLength();
  }
}

const context = createContext<Context | null>(null);

function MulticallFetcher({ context: contextInstance }: { context: Context }) {
  const { library: web3 } = useWeb3();
  const blockNumber = useBehaviorSubject(useBlockNumber$Context());

  const { calls, sameCalls } = useBehaviorSubject(contextInstance.calls$);

  const { lastResults$ } = contextInstance;

  const multicall = useMemo(
    () =>
      web3 &&
      new Multicall({
        web3Instance: web3,
      }),
    [web3],
  );

  useEffect(() => {
    if (!multicall || !calls.length || !blockNumber) return;

    let canceled = false;

    setTimeout(() => {
      if (canceled) return;

      multicall
        .call(calls)
        .then(response => {
          if (canceled) return;

          const copy: ContractCallResults = {
            results: { ...response.results },
            blockNumber: response.blockNumber,
          };
          const { results } = copy;
          // eslint-disable-next-line guard-for-in
          for (const i in sameCalls) {
            const search = sameCalls[i];
            results[i] = results[search];
          }
          lastResults$.next(copy);
        })
        .catch(console.error);
    }, 0);

    return () => {
      canceled = true;
    };
  }, [multicall, blockNumber, calls, sameCalls, lastResults$]);

  return null;
}

export function MulticallContextProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [contextInstance] = useState(() => new Context());

  return (
    <context.Provider value={contextInstance}>
      <MulticallFetcher context={contextInstance} />
      {children}
    </context.Provider>
  );
}

export function useMulticallContext() {
  const value = useContext(context);
  if (!value) throw new Error('MulticallContext not provided');
  return value;
}

type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? A
  : B;
type WritableKeysOf<T> = {
  [P in keyof T]: IfEquals<
    {
      [Q in P]: T[P];
    },
    {
      -readonly [Q in P]: T[P];
    },
    P,
    never
  >;
}[keyof T];
type ReadonlyPart<T> = Omit<T, WritableKeysOf<T>>;
type ExtractArrayType<T> = T extends Array<infer U> ? U : T;
type ExtractNotFalsy<T> = Exclude<T, Falsy>;
export function useMulticallMany<
  T extends IfEquals<
    keyof Call,
    keyof ReadonlyPart<ExtractNotFalsy<ExtractArrayType<T>>>,
    (Readonly<Call> | Falsy)[],
    never
  >
>(calls: T) {
  const multicallContext = useMulticallContext();
  const lastResults = useBehaviorSubject(multicallContext.lastResults$);

  const dependencies = useVariableLengthDependencies(calls);

  const ids = useMemo(
    () => calls.map(call => call && multicallContext.add(call)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dependencies, multicallContext],
  );

  useEffect(() => () => ids.forEach(id => id && multicallContext.remove(id)), [
    ids,
    multicallContext,
  ]);

  return calls.map(
    (call, index) => call && lastResults.results[ids[index] as string],
  );
}

export function useMulticall(call: Readonly<Call> | Falsy) {
  return useMulticallMany([call])[0];
}

export function useMulticallMultipleAddresses(
  addresses: (string | Falsy)[],
  abi: AbiItem[],
  methodName: string,
  args?: (string | number)[],
) {
  const addressesDependency = useVariableLengthDependencies(addresses);
  const argsDependency = useVariableLengthDependencies(args);
  const memo = useMemo(
    () =>
      addresses.map(
        address =>
          address &&
          Object.freeze({
            contractAddress: address,
            abi,
            calls: [
              {
                reference: '',
                methodName,
                methodParameters: args,
              },
            ],
          } as Call),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addressesDependency, abi, methodName, argsDependency],
  );

  return useMulticallMany(memo).map(
    result => result && result.callsReturnContext[0].returnValues,
  );
}

export interface ContractCall<
  Contract extends BaseContract,
  MethodName extends keyof Contract & string,
  Method extends Contract[MethodName] & (() => void)
> {
  contract: Contract;
  method: MethodName;
  args: Parameters<Method>;
}

function warnOnInvalidContractCall<
  Contract extends BaseContract,
  MethodName extends keyof Contract & string,
  Method extends Contract[MethodName] & (() => void)
>(call: ContractCall<Contract, MethodName, Method> | Falsy) {
  console.error(
    `Invalid contract call: address=${
      call && call.contract.options.address
    } method=${call && call.method} args=${call && call.args}`,
  );
}

function encodeCallData<
  Contract extends BaseContract,
  MethodName extends keyof Contract & string,
  Method extends Contract[MethodName] & (() => void)
>(
  call: ContractCall<Contract, MethodName, Method> | Falsy,
): Falsy | Readonly<Call> {
  return (
    call &&
    Object.freeze({
      contractAddress: call.contract.options.address,
      abi: call.contract.options.jsonInterface,
      calls: [
        {
          reference: '',
          methodName: call.method,
          methodParameters: call.args,
        },
      ],
    })
  );
}

export function useContractCall<
  ReturnValue,
  Contract extends BaseContract,
  MethodName extends keyof Contract & string,
  Method extends Contract[MethodName] & (() => Promise<ReturnValue>)
>(
  call: ContractCall<Contract, MethodName, Method> | Falsy,
): ReturnValue | undefined {
  return useContractCalls<ReturnValue, Contract, MethodName, Method>([call])[0];
}

export function useContractCalls<
  ReturnValue,
  Contract extends BaseContract,
  MethodName extends keyof Contract & string,
  Method extends Contract[MethodName] & (() => Promise<ReturnValue>)
>(
  calls: (ContractCall<Contract, MethodName, Method> | Falsy)[],
): (ReturnValue | undefined)[] {
  type K = ContractCall<Contract, MethodName, Method>;
  type T = K[keyof K];
  const callsDependency = useVariableLengthDependencies<T>(
    (calls as unknown) as (Record<string, T> | Falsy)[],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const callsData = useMemo(() => calls.map(encodeCallData), [callsDependency]);
  const results = useMulticallMany(callsData);

  return useMemo(
    () =>
      results.map((result, idx) => {
        if (!result) return;

        const call = calls[idx];
        if (!result.callsReturnContext[0].success) {
          warnOnInvalidContractCall(call);
          return undefined;
        }
        return call && result
          ? ((result.callsReturnContext[0]
              .returnValues as unknown) as ReturnValue)
          : undefined;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callsDependency, results],
  );
}

// https://github.com/joshstevens19/ethereum-multicall/issues/13
(Multicall.prototype as any).formatReturnValues = patchedFormat;

function patchedFormat(decodedReturnValues: any) {
  // ethers put the result of the decode in an array sometimes.
  const decodedReturnResults = decodedReturnValues[0];
  // if (Array.isArray(decodedReturnResults)) {
  //     return decodedReturnResults;
  // }
  if (Array.isArray(decodedReturnValues)) {
    return decodedReturnValues;
  }
  return [decodedReturnResults];
}
