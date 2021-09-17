// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

interface ISynthereumAutonomousPoolInteraction {
  /**
   * @notice Returns price identifier of the pool
   * @return identifier Price identifier
   */
  function getPriceFeedIdentifier() external view returns (bytes32 identifier);
}
