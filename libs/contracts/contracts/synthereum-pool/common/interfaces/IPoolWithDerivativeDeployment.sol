// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumPoolDeployment} from './IPoolDeployment.sol';

/**
 * @title Interface that an autonomous pool MUST have in order to be included in the deployer
 */
interface ISynthereumPoolWithDerivativeDeployment is ISynthereumPoolDeployment {
  /**
   * @notice Check that a derivative is admitted in the pool
   * @param derivative Address of the derivative to be checked
   * @return isAdmitted true if derivative is admitted otherwise false
   */
  function isDerivativeAdmitted(address derivative)
    external
    view
    returns (bool isAdmitted);
}
