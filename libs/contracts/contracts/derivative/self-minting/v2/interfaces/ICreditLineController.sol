// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {ICreditLineStorage} from './ICreditLineStorage.sol';

/** @title Interface for interacting with the SelfMintingController
 */
interface ICreditLineController {
  /**
   * @notice Allow to set overcollateralization percentage on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param overcollateralPct Over collateralization percentage for self-minting derivatives
   */
  function setOvercollateralization(
    address[] calldata selfMintingDerivatives,
    uint256[] calldata overcollateralPct
  ) external;

  /**
   * @notice Allow to set capMintAmount on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param capMintAmounts Mint cap amounts for self-minting derivatives
   */
  function setCapMintAmount(
    address[] calldata selfMintingDerivatives,
    uint256[] calldata capMintAmounts
  ) external;

  /**
   * @notice Allow to set fee percentages on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param feePercentages fee percentages for self-minting derivatives
   */
  function setFeePercentage(
    address[] calldata selfMintingDerivatives,
    FixedPoint.Unsigned[] calldata feePercentages
  ) external;

  /**
   * @notice Update the addresses and weight of recipients for generated fees
   * @param selfMintingDerivatives Derivatives to update
   * @param feeRecipients A two-dimension array containing for each derivative the addresses of fee recipients
   * @param feeProportions An array of the proportions of fees generated each recipient will receive
   */
  function setFeeRecipients(
    address[] calldata selfMintingDerivatives,
    address[][] calldata feeRecipients,
    uint32[][] calldata feeProportions
  ) external;

  /**
   * @notice Update the liquidation reward percentage
   * @param selfMintingDerivatives Derivatives to update
   * @param _liquidationRewards Percentage of reward for correct liquidation by a liquidator
   */
  function setLiquidationRewardPercentage(
    address[] calldata selfMintingDerivatives,
    FixedPoint.Unsigned[] calldata _liquidationRewards
  ) external;

  /**
   * @notice Gets the over collateralization percentage of a self-minting derivative
   * @param selfMintingDerivative Derivative to read value of
   * @return the overcollateralization percentage
   */
  function getOvercollateralizationPercentage(address selfMintingDerivative)
    external
    view
    returns (uint256);

  /**
   * @notice Gets the set liquidtion reward percentage of a self-minting derivative
   * @param selfMintingDerivative Self-minting derivative
   * @return liquidation Reward percentage
   */
  function getLiquidationRewardPercentage(address selfMintingDerivative)
    external
    view
    returns (uint256);

  /**
   * @notice Gets the set CapMintAmount of a self-minting derivative
   * @param selfMintingDerivative Self-minting derivative
   * @return capMintAmount Limit amount for minting
   */
  function getCapMintAmount(address selfMintingDerivative)
    external
    view
    returns (uint256 capMintAmount);

  /**
   * @notice Gets the fee params of a self-minting derivative
   * @param selfMintingDerivative Self-minting derivative
   * @return fee fee info (percent + recipient + proportions)
   */
  function getFeeInfo(address selfMintingDerivative)
    external
    view
    returns (ICreditLineStorage.Fee memory fee);
}
