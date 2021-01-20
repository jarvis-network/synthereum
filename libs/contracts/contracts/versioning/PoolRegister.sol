// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {ISynthereumPoolRegistry} from './interfaces/IPoolRegistry.sol';
import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SynthereumInterfaces} from './Constants.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/EnumerableSet.sol';
import {
  Lockable
} from '@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';

/**
 * @title Register and track all the pools deployed
 */
contract SynthereumPoolRegistry is ISynthereumPoolRegistry, Lockable {
  using EnumerableSet for EnumerableSet.AddressSet;

  //----------------------------------------
  // State variables
  //----------------------------------------

  ISynthereumFinder public synthereumFinder;

  //map with key (synthetic token symbol, collateral address, synthereum version) and values an array of Pools
  mapping(string => mapping(IERC20 => mapping(uint8 => EnumerableSet.AddressSet)))
    private symbolToPools;

  //Set containing collateral address
  EnumerableSet.AddressSet private collaterals;

  //----------------------------------------
  // Constructors
  //----------------------------------------

  /**
   * @notice Constructs the SynthereumPoolRegister contract
   * @param _synthereumFinder Synthereum finder contract
   */
  constructor(ISynthereumFinder _synthereumFinder) public {
    synthereumFinder = _synthereumFinder;
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Allow the deployer to register a pool just deployed
   * @param syntheticTokenSymbol Symbol of the syntheticToken
   * @param collateralToken Collateral ERC20 token of the pool deployed
   * @param poolVersion Version of the pool deployed
   * @param pool Address of the pool deployed
   */
  function registerPool(
    string calldata syntheticTokenSymbol,
    IERC20 collateralToken,
    uint8 poolVersion,
    address pool
  ) external override nonReentrant {
    address deployer =
      ISynthereumFinder(synthereumFinder).getImplementationAddress(
        SynthereumInterfaces.Deployer
      );
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    symbolToPools[syntheticTokenSymbol][collateralToken][poolVersion].add(pool);
    collaterals.add(address(collateralToken));
  }

  //----------------------------------------
  // External view functions
  //----------------------------------------

  /**
   * @notice Returns if a particular pool exists or not
   * @param poolSymbol Synthetic token symbol of the pool
   * @param collateral ERC20 contract of collateral currency
   * @param poolVersion Version of the pool
   * @param pool Contract of the pool to check
   * @return isDeployed Returns true if a particular pool exists, otherwiise false
   */
  function isPoolDeployed(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion,
    address pool
  ) external view override nonReentrantView returns (bool isDeployed) {
    isDeployed = symbolToPools[poolSymbol][collateral][poolVersion].contains(
      pool
    );
  }

  /**
   * @notice Returns all the pools with partcular symbol, collateral and verion
   * @param poolSymbol Synthetic token symbol of the pool
   * @param collateral ERC20 contract of collateral currency
   * @param poolVersion Version of the pool
   * @return List of all pools
   */
  function getPools(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion
  ) external view override nonReentrantView returns (address[] memory) {
    EnumerableSet.AddressSet storage poolSet =
      symbolToPools[poolSymbol][collateral][poolVersion];
    uint256 numberOfPools = poolSet.length();
    address[] memory pools = new address[](numberOfPools);
    for (uint256 j = 0; j < numberOfPools; j++) {
      pools[j] = poolSet.at(j);
    }
    return pools;
  }

  /**
   * @notice Returns all the collateral used
   * @return List of all collaterals
   */
  function getCollaterals()
    external
    view
    override
    nonReentrantView
    returns (address[] memory)
  {
    uint256 numberOfCollaterals = collaterals.length();
    address[] memory collateralAddresses = new address[](numberOfCollaterals);
    for (uint256 j = 0; j < numberOfCollaterals; j++) {
      collateralAddresses[j] = collaterals.at(j);
    }
    return collateralAddresses;
  }
}
