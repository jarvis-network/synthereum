import { Id } from './meta';

type Empty = null | undefined | never;

type Tag<Kind, Data = null> = Data extends null
  ? { kind: Kind }
  : {
      kind: Kind;
      data: Data;
    };

/**
 * Constructs a tagged (aka branded) type, by "attaching" (intersecting)
 * `Tag<Value>` to `Type`.
 *
 * Example:
 * ```ts
 * type Length = Tagged<number, 'length'>;
 * type Weight = Tagged<number, 'weight'>;
 * ```
 * Now `Length` and `Weight` are distinct types:
 * ```ts
 * const distanceBetweenCities = 123 as Length;
 * const carWeight = 1000 as Weight;
 * const otherCarWeight: Weight = distanceBetweenCities;
 * //    ^^^^^^^^^^^^^^ error - [..] Type '"length"' is not assignable to type '"weight"'
 *```
 *
 * Beware that the result of operations on tagged types is not wrapped,
 * so the following can't be prevented:
 *
 * ```ts
 * const num = distanceBetweenCities + carWeight; // typeof num is 'number'
 * ```
 * ---
 * A tagged type can be further refined (enhanced):
 * ```ts
 * type Length = Tagged<number, 'length'>;
 * type Km = ExtendTagged<Length, { unit: 'kilometer' }>;
 * type Cm = ExtendTagged<Length, { unit: 'centimeter' }>;
 * type Mile = ExtendTagged<Length, { unit: 'mile' }>;
 * ```
 * ---
 *
 * More advanced example:
 *
 * ```ts
 * type Address = Tagged<string, 'Ethereum Address'>;
 * type KovanAddress = Tagged<Address, { network: 'kovan' }>;
 * type NonZeroKovanAddress = Tagged<KovanAddress, { zeroAddress: false }>;
 * type AdvancedAddress1 = Tagged<NonZeroKovanAddress, { hasTransactions: true }>;
 * type AdvancedAddress2 = Tagged<
 *   AdvancedAddress1,
 *   { seenOnNetworks: ['kovan', 'mainnet'] }
 * >;
 * ```
 *
 * Inspecting the `AdvancedAddress2` type yields the following:
 * ```ts
 * type AdvancedAddress2BaseTypeOf = BaseTypeOf<AdvancedAddress2>; // string
 * type AdvancedAddress2TagKind = TagKindOf<AdvancedAddress2>; // "Ethereum Address"
 * type AdvancedAddress2Tag = TagOf<AdvancedAddress2>;
 * ```
 *
 * `AdvancedAddress2Tag` is resolved to:
 *
 * ```ts
 * {
 *   [kind]: "Ethereum Address";
 *   seenOnNetworks: ['kovan', 'mainnet'];
 *   hasTransactions: true;
 *   zeroAddress: false;
 *   network: 'kovan';
 * }
 * ```
 */
export type Tagged<Type, Kind> = Type extends TaggedValue<
  infer BaseType,
  infer BaseKind,
  infer BaseData
>
  ? BaseData extends Empty
    ? TaggedValue<BaseType, BaseKind, Kind>
    : TaggedValue<BaseType, BaseKind, Id<Kind & BaseData>>
  : TaggedValue<Type, Kind, null>;

type TaggedValue<Type, Kind, Data> = Type & Tag<Kind, Data>;

/**
 * Gets the **base type** of a tagged type `TT`.
 *
 * Example:
 *
 * ```ts
 * type ContractAbi<C extends BaseContract> = Tagged<AbiItem[], C>;
 * type T1 = ContractAbi<ERC20>;
 * type X = BaseTypeOf<T1>; // Resolved to: AbiItem[]
 * ```
 */
export type BaseTypeOf<TT> = TT extends TaggedValue<
  infer BaseType,
  infer A,
  infer B
>
  ? BaseType
  : never;

/**
 * Get the **kind** of a tagged type `TT`.
 *
 * Example:
 *
 * ```ts
 * type ContractAbi<C extends BaseContract> = Tagged<AbiItem[], C>;
 * type T1 = ContractAbi<ERC20>;
 * type X = TagKindOf<T1>; // Resolved to: ERC20
 * ```
 */
export type TagKindOf<TT> = TT extends TaggedValue<infer _, infer Kind, infer _>
  ? Kind
  : never;

/**
 * Gets the full tag information from a tagged type `TT`.
 *
 * Example:
 *
 * ```ts
 * type Address = Tagged<string, 'Ethereum Address'>;
 * type KovanAddress = Tagged<Address, { network: 'kovan' }>;
 * type KovanAddressTag = TagOf<KovanAddress>;
 * ```
 *
 * `KovanAddressTag` is resolved to:
 *
 * ```ts
 * {
 *    [kind]: "Ethereum Address";
 *    network: 'kovan';
 * }
 * ```
 */
export type TagOf<TT> = TT extends TaggedValue<infer _, infer Kind, infer Data>
  ? Id<{ kind: Kind } & (Data extends null ? {} : Data)>
  : never;

//#region Test code
type Address = Tagged<string, 'Ethereum Address'>;
type AddressBaseTypeOf = BaseTypeOf<Address>;
type AddressTagKind = TagKindOf<Address>;
type AddressTag = TagOf<Address>;
const address: Address = 'asd' as Address;
const addressTagKind: AddressTagKind = 'Ethereum Address';
const addressBaseTypeOf: AddressBaseTypeOf = '0x123';
const addressTag: AddressTag = {
  kind: addressTagKind,
};

type KovanAddress = Tagged<Address, { network: 'kovan' }>;
type KovanAddressBaseTypeOf = BaseTypeOf<KovanAddress>;
type KovanAddressTagKind = TagKindOf<KovanAddress>;
type KovanAddressTag = TagOf<KovanAddress>;
const kovanAddressTagKind: KovanAddressTagKind = 'Ethereum Address';
const kovanAddressBaseTypeOf: KovanAddressBaseTypeOf = '0x123';
const kovanAddressTag: KovanAddressTag = {
  kind: kovanAddressTagKind,
  network: 'kovan',
};

type NonEmptyKovanAddress = Tagged<KovanAddress, { zeroAddress: false }>;
type AdvancedAddress1 = Tagged<NonEmptyKovanAddress, { hasTransactions: true }>;
type AdvancedAddress2 = Tagged<
  AdvancedAddress1,
  { seenOnNetworks: ['kovan', 'mainnet'] }
>;
type AdvancedAddress2BaseTypeOf = BaseTypeOf<AdvancedAddress2>;
type AdvancedAddress2TagKind = TagKindOf<AdvancedAddress2>;
type AdvancedAddress2Tag = TagOf<AdvancedAddress2>;
const x: AdvancedAddress2 = 'asd' as AdvancedAddress2;
//#endregion
