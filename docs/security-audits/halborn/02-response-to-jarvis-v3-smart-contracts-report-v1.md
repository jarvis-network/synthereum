# Response to Halborn's "JARVIS Smart Contract Security Audit Security" from March 09, 2021

This document is a summary of the analysis made by Synthereum developers on
[the second security audit performed by Halborn](./02-jarvis-v3-smart-contracts-report-v1.pdf)
on `SynthereumPoolOnChainPriceFeed` (version 3) of the Synthereum protocol.

## Scope

> The security assessment was scoped to the smart contracts under these
> folders:
>
> * [`contracts/base/`](../../../libs/contracts/contracts/contracts/base)
> * [`contracts/versioning/`](../../../libs/contracts/contracts/contracts/core) (developer note: this folder was renamed to `contracts/core` after the audit)
> * [`contracts/derivative/`](../../../libs/contracts/contracts/contracts/derivative)
> * [`contracts/oracle/`](../../../libs/contracts/contracts/contracts/oracle)
> * [`contracts/synthereum-pool/v3/`](../../../libs/contracts/contracts/contracts/synthereum-pool/v3)
>
> Specific commit of contracts:
> [`27f7c257038b349352a0bdfcafba4a1c35fd569d`](https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/tree/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts).

[SynthereumDerivativeFactory]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/derivative/v1/DerivativeFactory.sol

[SynthereumDerivativeFactory_L34]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/derivative/v1/DerivativeFactory.sol#L34

[SynthereumSyntheticTokenFactory]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/derivative/v1/SyntheticTokenFactory.sol

[SynthereumSyntheticTokenFactory_L26]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/derivative/v1/SyntheticTokenFactory.sol#L26

[SynthereumSyntheticTokenFactory]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/synthereum-pool/v3/PoolChainPriceFeedFactory.sol

[SynthereumPoolOnChainPriceFeedFactory]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/synthereum-pool/v3/PoolOnChainPriceFeedFactory.sol

[SynthereumPoolOnChainPriceFeedLib]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/synthereum-pool/v3/PoolOnChainPriceFeedLib.sol

[SynthereumPoolOnChainPriceFeedLib_L141]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/synthereum-pool/v3/PoolOnChainPriceFeedLib.sol#L141

[SynthereumPoolOnChainPriceFeedLib_L1128]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/synthereum-pool/v3/PoolOnChainPriceFeedLib.sol#L1128

[SynthereumPoolRegistry]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/versioning/PoolRegister.sol

[SynthereumFactoryVersioning]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/versioning/FactoryVersioning.sol

[SynthereumFactoryVersioning_L82]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/27f7c257038b349352a0bdfcafba4a1c35fd569d/libs/contracts/contracts/contracts/oracle/chainlink/ChainlinkPriceFeed.sol#L82

## Findings

### 3.1 FLOATING PRAGMA - LOW

> All Smart Contracts use the floating pragma `ˆ0.6.12`. Contracts should be
deployed with the same compiler version and flags that they have been tested
with thoroughly. [..]
>
> Recommendations:
Consider lock the pragma version known bugs for the compiler version.
When possible, do not use floating pragma in the final live deployment.
Pragma can also be locked fixing the compiler version in the configuration
file when you deploy contracts with truffle or hardhat frameworks.

Our [Hardhat config file](../../../libs/contracts/hardhat.config.ts) locks
the Solidity compiler version to `0.6.12`. The choice of using floating
version pragma in the contracts is deliberate for a few reasons:

* Better code maintenance - in order to upgrade to a newer compiler version
  (e.g. because it includes an important bug fix), only the Hardhat config
  file needs to be changed, instead of every single `*.sol` file.
* Third-party contract dependencies also use floating version pragmas, and
  using the same approach eases compatibility
* Other developers, or researchers who want to experiment with our contracts
  may prefer to use a different version. Fixing the version in every contract
  makes it more cumbersome.

### 3.2 MISSING ADDRESS CHECK - LOW

> Address validation at some places in contracts:
>
> * [`contracts/derivative/v1/DerivativeFactory.sol`][SynthereumDerivativeFactory]
> * [`contracts/derivative/v1/SyntheticTokenFactory.sol`][SynthereumSyntheticTokenFactory]
> * [`contracts/synthereum-pool/v3/PoolChainPriceFeedFactory.sol`][SynthereumPoolOnChainPriceFeedFactory]
>
> Lack of zero address validation has been found at many instances when
> assigning user supplied address values to state variables directly.

In all of the highlighted cases, the missing zero address validation is for a
constructor parameter accepting a SynthereumFinder contract instance. Since
all contracts are deployed from our migration scripts, which take care of
passing the right SynthereumFinder instance, we consider this issue of low
significance. In the worst case, if a third-party developer deploy one of
these contracts by providing a wrong address SynthereumFinder address, he
will end up burning gas, but with no further consequences.

### 3.3 USE OF BLOCK.TIMESTAMP

> Block timestamps have historically been used for a variety of applications,
such as entropy for random numbers, locking funds for periods of time and
various state-changing conditional statements that are time- dependent.
Miner’s have the ability to adjust timestamps slightly which can prove to be
quite dangerous if block timestamps are used incorrectly in smart contracts.

Synthereum contracts don't rely on block timestamps for randomness. Block time
stamps are strictly monotonically increasing, which is sufficient for the
correctness time-dependent logic in our use cases.

### 3.4 IGNORE RETURN VALUES - INFORMATIONAL

> The return value of an external call is not stored in a local or state
> variable. In contracts:
>
> * [`contracts/synthereum-pool/v3/PoolOnChainPriceFeedLib.sol`][SynthereumPoolOnChainPriceFeedLib]
> * [`contracts/versioning/PoolRegister.sol`][SynthereumPoolRegistry]
> * [`contracts/versioning/FactoryVersioning.sol`][SynthereumFactoryVersioning]
>
> there are few instances where external methods are being called and
> return value(bool) are being ignored.

* `contracts/synthereum-pool/v3/PoolOnChainPriceFeedLib.sol:178` -
  `EnumerableSet.AddressSet.add` returns a boolean value indicating whether
  an element has been added. In this case, it is called from the
  `SynthereumPoolOnChainPriceFeedLib.initialize` function. This function is
  called only from the constructor of `SynthereumPoolOnChainPriceFeed` so in
  that case `self.derivative.add(_derivative)` will always return true, so
  using the return value is useless.

* `contracts/synthereum-pool/v3/PoolOnChainPriceFeedLib.sol:598` -
  `settleEmergencyShutdown` return the amount withdrawn as a result of the
  settlement. Using the value is unnecessary for the logic that follows.

* `contracts/synthereum-pool/v3/PoolOnChainPriceFeedLib.sol:719` - this is an
  error on our part. The `isPoolDeployed` function call can be removed, since
  it is useless (it doesn't mutate any state).

* `contracts/versioning/PoolRegister.sol:40-41` - checking the return value is
  not needed for the logic of the function.

* `contracts/versioning/FactoryVersioning.sol:66` - we consider this a false
  positive, since the return value is used by the `require` statement.

* `contracts/versioning/FactoryVersioning.sol:77` - checking the return value
  is unnecessary, since the intention of the function is to add or replace (an
  existing) derivative factory. That said, a potential improvement would be
  to change the name of the event to `SetDerivativeFactory` to make the
  effect more clear.

[slither]: https://github.com/crytic/slither

### 3.5 STATIC ANALYSIS REPORT ([Slither][slither])

> Halborn used automated testing techniques to enhance coverage of certain
areas of the scoped contract. Among the tools used was Slither, a Solidity
static analysis framework. After Halborn verified all the contracts in the
repository and was able to compile them correctly into their abi and binary
formats. This tool can statically verify mathematical relationships between
Solidity variables to detect invalid or inconsistent usage of the contracts’
APIs across the entire code-base.

* Reentrancy in warnings for several contracts in
  `@jarvis-network/uma-core/contracts/financial-templates/perpetual-poolParty/` -
  we believe all of these cases are false positives, since the code uses the
  `nonReentrant` modifier pattern to protect against reentrancy.

* Divide Before Multiply for several contracts in
  `@jarvis-network/uma-core/contracts/financial-templates/perpetual-poolParty/` -
  the code follows a general pattern as the other financial templates. The
  intention of dividing before multiplying is to perform floor rounding.

* Strict equality check in `PerpetualPositionManagerPoolParty.sol#L529` -
  `emergencyShutdownTimestamp` is zero iff the `emergencyShutdown()`
  function hasn't been called, so strict comparison with zero is vital for the
  correctness of the function.

* Strict equality check in `PerpetualPositionManagerPoolParty.sol#L332-326` -
  comparing `message.sender` against `_getFinancialContractsAdminAddress()`
  is necessary

[mythx]: https://mythx.io/

### 3.6 AUTOMATED SECURITY SCAN ([MythX][mythx])

> Halborn used automated security scanners to assist with detection of
well-known security issues, and to identify low-hanging fruit on the targets
for this engagement. Among the tools used was MythX, a security analysis
service for Ethereum smart contracts. MythX performed a scan on the testers
machine and sent the compiled results to the analyzers to locate any
vulnerabilities. In addition, Security Detections are only in scope.

* [Floating Pragma](https://swcregistry.io/docs/SWC-103) - already addressed [above](#31-floating-pragma-low)

* `contracts/synthereum-pool/v3/PoolOnChainPriceFeedLib.sol`
  * [Line #141][SynthereumPoolOnChainPriceFeedLib_L141] - [Authorization
    through `tx.origin`](https://swcregistry.io/docs/SWC-115) - used in
    modifier `checkIsSenderContract` - this is used as a best effort way to
    prevent other contracts from calling functions with this modifier.
  * [Line #1128][SynthereumPoolOnChainPriceFeedLib_L1128] - Incorrect
    function `checkParams` state mutability - we believe this is a false
    positive, since the function reads, but doesn't modify the contract state
    and hence it's marked as `view`.

* `contracts/oracle/chainlink/ChainlinkPriceFeed.sol`:
  * [Line #82][SynthereumFactoryVersioning_L82] - [Authorization through `tx.origin`](https://swcregistry.io/docs/SWC-115) -
    this modifier allow functions declared with it to be called off-chain via
    the `eth_call` JSON RPC method, yet prevent calls from other contracts,
    unless certain conditions are met.

* `contracts/derivative/v1/SyntheticTokenFactory.sol`
  * [Line #26][SynthereumSyntheticTokenFactory_L26] - Function could be marked as external - the intention is to allow
    derived contracts to call this function

* `contracts/derivative/v1/DerivativeFactory.sol`
  * [Line #34][SynthereumDerivativeFactory_L34] - Function could be marked as external - the intention is to allow
    derived contracts to call this function
