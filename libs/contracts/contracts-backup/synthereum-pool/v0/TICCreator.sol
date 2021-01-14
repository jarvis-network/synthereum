// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IDerivative} from '../../derivative/common/interfaces/IDerivative.sol';
import {ISynthereumFinder} from '../../versioning/interfaces/IFinder.sol';
import {SynthereumTICInterface} from './interfaces/ITIC.sol';
import {
  Lockable
} from '@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';
import {SynthereumTIC} from './TIC.sol';

contract TICCreator is Lockable {
  //----------------------------------------
  // Public functions
  //----------------------------------------

  /**
   * @notice The derivative's margin currency must be an ERC20
   * @notice The validator will generally be an address owned by the LP
   * @notice `startingCollateralization should be greater than the expected asset price multiplied
   *      by the collateral requirement. The degree to which it is greater should be based on
   *      the expected asset volatility.
   * @param derivative The perpetual derivative
   * @param finder The Synthereum finder
   * @param version Synthereum version
   * @param roles The addresses of admin, maintainer, liquidity provider and validator
   * @param startingCollateralization Collateralization ratio to use before a global one is set
   * @param fee The fee structure
   * @return poolDeployed Pool contract deployed
   */
  function createTIC(
    IDerivative derivative,
    ISynthereumFinder finder,
    uint8 version,
    SynthereumTICInterface.Roles memory roles,
    uint256 startingCollateralization,
    SynthereumTICInterface.Fee memory fee
  ) public virtual nonReentrant returns (SynthereumTIC poolDeployed) {
    // Create the Pool
    poolDeployed = new SynthereumTIC(
      derivative,
      finder,
      version,
      roles,
      startingCollateralization,
      fee
    );
  }
}
