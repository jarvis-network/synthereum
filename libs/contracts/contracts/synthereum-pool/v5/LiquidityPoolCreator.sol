// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumLiquidityPoolStorage
} from './interfaces/ILiquidityPoolStorage.sol';
import {SynthereumLiquidityPool} from './LiquidityPool.sol';
import {Lockable} from '@uma/core/contracts/common/implementation/Lockable.sol';

contract SynthereumLiquidityPoolCreator is Lockable {
  //----------------------------------------
  // Public functions
  //----------------------------------------

  /**
   * @notice Deploy new liquidity pool
   * @param finder The Synthereum finder
   * @param version Synthereum version
   * @param collateralToken ERC20 collateral token
   * @param syntheticToken ERC20 synthetic token
   * @param roles The addresses of admin, maintainer, liquidity provider and validator
   * @param overCollateralization Overcollateralization percentage
   * @param feeData The feeData structure
   * @param priceIdentifier Identifier of price to be used in the price feed
   * @param collateralRequirement Percentage of overcollateralization to which a liquidation can triggered
   * @param liquidationReward Percentage of reward for correct liquidation by a liquidator
   * @return poolDeployed Liquidity pool contract deployed
   */
  function createPool(
    ISynthereumFinder finder,
    uint8 version,
    IStandardERC20 collateralToken,
    IMintableBurnableERC20 syntheticToken,
    ISynthereumLiquidityPoolStorage.Roles calldata roles,
    uint256 overCollateralization,
    ISynthereumLiquidityPoolStorage.FeeData calldata feeData,
    bytes32 priceIdentifier,
    uint256 collateralRequirement,
    uint256 liquidationReward
  ) public virtual nonReentrant returns (SynthereumLiquidityPool poolDeployed) {
    poolDeployed = new SynthereumLiquidityPool(
      finder,
      version,
      collateralToken,
      syntheticToken,
      roles,
      overCollateralization,
      feeData,
      priceIdentifier,
      collateralRequirement,
      liquidationReward
    );
  }
}
