// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {
  ISynthereumMultiLpLiquidityPool
} from './interfaces/IMultiLpLiquidityPool.sol';
import {
  ISynthereumMultiLpLiquidityPoolEvents
} from './interfaces/IMultiLpLiquidityPoolEvents.sol';
import {
  EnumerableSet
} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

/**
 * @title Multi LP Synthereum pool
 */
contract SynthereumMultiLpLiquidityPool is
  ISynthereumMultiLpLiquidityPoolEvents,
  ISynthereumMultiLpLiquidityPool,
  AccessControlEnumerable
{
  using EnumerableSet for EnumerableSet.AddressSet;

  //----------------------------------------
  // Constants
  //----------------------------------------

  string public constant override typology = 'POOL';

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //----------------------------------------
  // Storage
  //----------------------------------------

  EnumerableSet.AddressSet private LPs;

  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, _msgSender()),
      'Sender must be the maintainer'
    );
    _;
  }

  /**
   * @notice Add a liquidity pool to the LP's whitelist
   * @notice This can be called only by the maintainer
   * @param lp Address of the LP
   */
  function addLP(address lp) external onlyMaintainer {
    require(LPs.add(lp), 'LP already member of the pool');
    emit AddedLp(lp);
  }

  /**
   * @notice Get all the LPs of this pool
   * @return The list of addresses of all the active LPs in the pool.
   */
  function getLPs() external view returns (address[] memory) {
    uint256 numberOfLPs = LPs.length();
    address[] memory activeLPs = new address[](numberOfLPs);
    for (uint256 j = 0; j < numberOfLPs; j++) {
      activeLPs[j] = LPs.at(j);
    }
    return activeLPs;
  }
}
