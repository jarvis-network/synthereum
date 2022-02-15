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

  EnumerableSet.AddressSet private registeredLPs;

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
   * @notice Register a liquidity provider to the LP's whitelist
   * @notice This can be called only by the maintainer
   * @param lp Address of the LP
   */
  function registerLP(address lp) external onlyMaintainer {
    require(registeredLPs.add(lp), 'LP already registered');
    emit RegisteredLp(lp);
  }

  /**
   * @notice Get all the registered LPs of this pool
   * @return The list of addresses of all the registered LPs in the pool.
   */
  function getRegisteredLPs() external view returns (address[] memory) {
    uint256 numberOfLPs = registeredLPs.length();
    address[] memory lpList = new address[](numberOfLPs);
    for (uint256 j = 0; j < numberOfLPs; j++) {
      lpList[j] = registeredLPs.at(j);
    }
    return lpList;
  }
}
