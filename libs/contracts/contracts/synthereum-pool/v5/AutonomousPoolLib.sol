// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  ISynthereumAutonomousPoolStorage
} from './interfaces/IAutonomousPoolStorage.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';

/**
 * @notice Pool implementation is stored here to reduce deployment costs
 */

library SynthereumAutonomousPoolLib {
  using FixedPoint for FixedPoint.Unsigned;
  using SynthereumAutonomousPoolLib for ISynthereumAutonomousPoolStorage.Storage;

  //----------------------------------------
  // Events
  //----------------------------------------
  event SetFeePercentage(uint256 feePercentage);

  event SetFeeRecipients(address[] feeRecipients, uint32[] feeProportions);

  //----------------------------------------
  // External function
  //----------------------------------------

  /**
   * @notice Initializes a fresh on chain pool
   * @notice `_overCollateralization should be greater than 0
   * @param self Data type the library is attached to
   * @param _finder The Synthereum finder
   * @param _version Synthereum version
   * @param _collateralToken ERC20 collateral token
   * @param _syntheticToken ERC20 synthetic token
   * @param _overCollateralization Over-collateralization ratio
   * @param _priceIdentifier Identifier of price to be used in the price feed
   */
  function initialize(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    ISynthereumFinder _finder,
    uint8 _version,
    IERC20 _collateralToken,
    IMintableBurnableERC20 _syntheticToken,
    FixedPoint.Unsigned memory _overCollateralization,
    bytes32 _priceIdentifier
  ) external {
    require(
      _overCollateralization.isGreaterThan(0),
      'Overcollateralization must be bigger than 0'
    );
    self.finder = _finder;
    self.version = _version;
    self.collateralToken = _collateralToken;
    self.syntheticToken = _syntheticToken;
    self.overCollateralization = _overCollateralization;
    self.priceIdentifier = _priceIdentifier;
  }

  /**
   * @notice Update the fee percentage
   * @param self Data type the library is attached to
   * @param _feePercentage The new fee percentage
   */
  function setFeePercentage(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    FixedPoint.Unsigned memory _feePercentage
  ) external {
    require(
      _feePercentage.rawValue < 10**(18),
      'Fee Percentage must be less than 100%'
    );
    self.fee.feePercentage = _feePercentage;
    emit SetFeePercentage(_feePercentage.rawValue);
  }

  /**
   * @notice Update the addresses of recipients for generated fees and proportions of fees each address will receive
   * @param self Data type the library is attached to
   * @param _feeRecipients An array of the addresses of recipients that will receive generated fees
   * @param _feeProportions An array of the proportions of fees generated each recipient will receive
   */
  function setFeeRecipients(
    ISynthereumAutonomousPoolStorage.Storage storage self,
    address[] calldata _feeRecipients,
    uint32[] calldata _feeProportions
  ) external {
    require(
      _feeRecipients.length == _feeProportions.length,
      'Fee recipients and fee proportions do not match'
    );
    uint256 totalActualFeeProportions;
    // Store the sum of all proportions
    for (uint256 i = 0; i < _feeProportions.length; i++) {
      totalActualFeeProportions += _feeProportions[i];
    }
    self.fee.feeRecipients = _feeRecipients;
    self.fee.feeProportions = _feeProportions;
    self.fee.totalFeeProportions = totalActualFeeProportions;
    emit SetFeeRecipients(_feeRecipients, _feeProportions);
  }
}
