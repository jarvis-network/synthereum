# Response to Halborn's "Jarvis Network Atomic-Swap V2 Smart Contract Security Audit" from November 05, 2021

This document is a summary of the analysis made by Jarvis developers on
[the first security audit performed by Halborn](./03-jarvis-atomic-swap-v2-report.pdf)
on `OnChainLiquidityRouter` (version 2) contracts.

## Scope

> The security assessment was scoped to the smart contracts under these
> folders:
>
> * [`atomic-swap/contracts/v2/`](../../../libs/atomic-swap/contracts/v2)

>
> Specific commit of contracts:
> [`e05d4aa807c8e170e8d457c2fae1bbc941a5fc27`](https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/tree/e05d4aa807c8e170e8d457c2fae1bbc941a5fc27/libs/atomic-swap/contracts/v2).

[OnChainLiquidityRouter.sol]: https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/e05d4aa807c8e170e8d457c2fae1bbc941a5fc27/libs/atomic-swap/contracts/v2/OnChainLiquidityRouter.sol


## Findings

### 3.1 CONTRACT ADMIN CAN REVOKE AND RENOUNCE HIMSELF - HIGH

> It was observed that in the contract [OnChainLiquidityRouter.sol] admin can revoke his role via  `revokeRole`, as well, can
renounce ownership via `renounceRole` function. If an admin is mistakenly
renounced/revoked, administrative access would result in the contract
having no admin, eliminating the ability to call privileged functions.
In such a case, contracts would have to be redeployed. [..]
>
> Recommendations:
It is recommended that the contract Admin cannot call `renounceRole` or
`revokeRole` without transferring the Ownership to other address before.
In addition, if a multi-signature wallet is used, calling `renounceRole`
or `revokeRole` function should be confirmed for two or more users.

Since at this stage the admin keys are still controlled by a multisignature, it's unlikely that this mistake can be made. Beside the issue concerns OpenZeppelin 'AccessControlEnumerable.sol`, so we would have to refactor that. We consider this issue of low significance.

### 3.2 REGISTRATION MISSING IMPLEMENTATION EXISTENCE VALIDATION - MEDIUM

> It was observed that in the contract
[OnChainLiquidityRouter.sol], the function `registerImplementation` doesn’t
validate whether the supplied implementation address exists or not.
That leads to spurious mappings that may be changed in the future to
that address or added to malicious implementations.

In all of the highlighted cases, the address validation is for an input parameter implementing a 'IOCLRBase' interface. Similar to above, since the function can be called only by an admin, a malicious implementation would mean a compromise of the admin keys, whereas an input mistake by the admin would lead to a waste of gas and a possible call to the bad address would most likely lead to a revert.

### 3.3  OUTDATED DEPENDENCIES - LOW

>It was noticed that the 4.1.0 version of openzepplin-contracts is used
in the in-scope Atomic-swap v2 contract. However, the latest version of
those libraries is 4.3.2, which fixes a vulnerability in UUPSUpgradeable.
Even though UUPSUpgradeable is not used directly within these contracts,
but it is a security best practice keeping all libraries up-to-date[...].

Since the issue doesn't directly affect the dependecies used in the contracts, this upgrade will be scheduled for next release.


### 3.4 EXPERIMENTAL FEATURES ENABLED - LOW

> ABIEncoderV2 is enabled to be able to pass struct type into a function,
both web3 and another contract. The use of expvxerimental features could
be dangerous on live deployments[...].

### 3.5 FLOATING PRAGMA - LOW

> All Smart Contracts use the floating pragma `ˆ0.8.4`. Contracts should be
deployed with the same compiler version and flags that they have been tested
with thoroughly. [..]
>
> Recommendations:
Consider lock the pragma version known bugs for the compiler version.
When possible, do not use floating pragma in the final live deployment.
Pragma can also be locked fixing the compiler version in the configuration
file when you deploy contracts with truffle or hardhat frameworks.

Our [Hardhat config file](../../../libs/contracts/hardhat.config.ts) locks
the Solidity compiler version to `0.8.4`. The choice of using floating
version pragma in the contracts is deliberate for a few reasons:

* Better code maintenance - in order to upgrade to a newer compiler version
  (e.g. because it includes an important bug fix), only the Hardhat config
  file needs to be changed, instead of every single `*.sol` file.
* Third-party contract dependencies also use floating version pragmas, and
  using the same approach eases compatibility
* Other developers, or researchers who want to experiment with our contracts
  may prefer to use a different version. Fixing the version in every contract
  makes it more cumbersome.
