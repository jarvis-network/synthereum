/* eslint-disable jest/expect-expect */
/* eslint-disable no-restricted-syntax */

import {
  deepStrictEqual as eq,
  notDeepStrictEqual as notEq,
  notStrictEqual as notShallowEq,
  throws,
} from 'assert';

import { deepSanitizedClone, deepMerge, TypedArray } from './deep-merge';

describe('deepSanitizedClone', () => {
  const s = Symbol('test');
  const primitiveValues = [null, undefined, false, true, 'asd', 42, s, 12n];
  const nestedArray = [
    [primitiveValues, [primitiveValues, primitiveValues]],
    [
      [
        [primitiveValues, primitiveValues],
        [primitiveValues],
        primitiveValues,
        [
          primitiveValues,
          [primitiveValues, [primitiveValues, [1, 2, 3], 4], 5, 6],
          7,
        ],
      ],
      primitiveValues,
      [primitiveValues],
    ],
  ];
  const nestedObject = {
    a: 1,
    b: {
      c: 3,
    },
    d: {
      e: { f: 6 },
      g: {
        h: { i: primitiveValues, j: [primitiveValues, [primitiveValues, 9]] },
      },
    },
  };
  it('should return primitive types unmodified', () => {
    for (const x of primitiveValues) eq(deepSanitizedClone(x), x);
  });

  it('should unwrap boxed types', () => {
    // skip `null` and `undefined`, as they can't be converted back losslessly
    for (const x of primitiveValues.slice(2))
      eq(deepSanitizedClone(Object(x)), x);
  });

  function checkArrays(typedArray: TypedArray | any[], arr: any[]) {
    const clone = deepSanitizedClone(typedArray);

    notShallowEq(clone, arr);
    notShallowEq(clone, typedArray);

    eq(clone.length, typedArray.length);
    for (let i = 0; i < clone.length; i++) {
      eq(clone[i], typedArray[i]);
    }
  }

  it('should clone typed arrays', () => {
    const types1 = [
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array,
    ];

    // eslint-disable-next-line no-undef
    const types2 = [BigInt64Array, BigUint64Array];

    const arr = [1, 2, 3, 4];
    for (const Type of types1) checkArrays(new Type(arr), arr);

    const barr = [1n, 2n, 3n, 4n];
    for (const Type of types2) checkArrays(new Type(barr), barr);
  });

  it('should reject DataView arguments', () => {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer, 0);
    throws(() => {
      const result = deepSanitizedClone(view);
    });
  });

  it('should clone arrays', () => {
    const arr = primitiveValues.slice();
    checkArrays(arr, arr);

    const nestedArrayClone = deepSanitizedClone(nestedArray);
    notShallowEq(nestedArrayClone, nestedArray);
    eq(nestedArrayClone, nestedArray);
  });

  it('should deep clone objects', () => {
    const obj1 = { a: 1, b: 2, c: { d: 4, e: 5 } };

    const clone = deepSanitizedClone(obj1);
    notShallowEq(clone, obj1);
    eq(clone, obj1);

    const netestObjectClone = deepSanitizedClone(nestedObject);
    notShallowEq(netestObjectClone, nestedObject);
    eq(netestObjectClone, nestedObject);
    netestObjectClone.d.g.h.j[0][0] = 123;
    notEq(netestObjectClone, nestedObject);
  });
});

describe('deepMerge', () => {
  it('should not modify arguments', () => {
    const a = {};
    const b = { key1: 'value1', key2: 'value2' };
    const res = deepMerge(a, b);
    eq(a, {});
    eq(res, b);
    notShallowEq(res, a);
    notShallowEq(res, b);
  });

  it('should merge level 1 objects', () => {
    expect(
      deepMerge(
        { key1: 'value1', key2: 'value2' },
        { key1: 'changed', key3: 'value3' },
      ),
    ).toEqual({ key1: 'changed', key2: 'value2', key3: 'value3' });
  });

  it('should merge level 2 objects', () => {
    expect(deepMerge({ b: { c: 'foo' } }, { a: { d: 'bar' } })).toEqual({
      a: { d: 'bar' },
      b: { c: 'foo' },
    });

    expect(deepMerge({ a: { b: 'foo' } }, { a: { c: 'bar' } })).toEqual({
      a: { b: 'foo', c: 'bar' },
    });

    expect(
      deepMerge(
        {
          key1: { subkey1: 'value1', subkey2: 'value2' },
        },
        {
          key1: { subkey1: 'changed', subkey3: 'added' },
        },
      ),
    ).toEqual({
      key1: {
        subkey1: 'changed',
        subkey2: 'value2',
        subkey3: 'added',
      },
    });
  });

  it('should handle null and undefined differently', () => {
    expect(
      deepMerge(
        { a: { x: 1 }, b: { y: 2 }, c: { z: { h: 2 } } },
        { a: undefined, b: null, c: { w: { f: 3 }, z: null } },
      ),
    ).toEqual({ a: { x: 1 }, b: null, c: { z: null, w: { f: 3 } } });
  });

  it('should override primitive types', () => {
    expect(
      deepMerge(
        { key1: 'value1', key2: 'value2' },
        { key1: { subkey1: 'subvalue1', subkey2: 'subvalue2' } },
      ),
    ).toEqual({
      key1: { subkey1: 'subvalue1', subkey2: 'subvalue2' },
      key2: 'value2',
    });
  });

  it('should ignore inherited members', () => {
    function A() {}
    A.prototype.protoMember = 'proton';
    const a = new (A as any)();
    a.a = 1;

    function B() {}
    B.prototype.protoMember = 'neutron';
    const b = new (B as any)();
    b.b = 2;

    expect(deepMerge(a, b)).toEqual({ a: 1, b: 2 });
  });

  it('should make last object win', () => {
    expect(deepMerge({ foo: 1 }, { bar: 2 }, { foo: 3 })).toEqual({
      bar: 2,
      foo: 3,
    });
  });
});
