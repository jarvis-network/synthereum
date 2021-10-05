// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  BaseControlledMintableBurnableERC20
} from '../../../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {FeePayerPartyLib} from '../../common/FeePayerPartyLib.sol';
import {
  PerpetualPositionManagerMultiPartyLib
} from './PerpetualPositionManagerMultiPartyLib.sol';
import {FeePayerParty} from '../../common/FeePayerParty.sol';
import {
  PerpetualLiquidatableMultiParty
} from './PerpetualLiquidatableMultiParty.sol';
import {
  PerpetualPositionManagerMultiParty
} from './PerpetualPositionManagerMultiParty.sol';

/** @title A library for PerpetualLiquidatableMultiParty contract
 */
library PerpetualLiquidatableMultiPartyLib {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using SafeERC20 for BaseControlledMintableBurnableERC20;
  using FixedPoint for FixedPoint.Unsigned;
  using PerpetualPositionManagerMultiPartyLib for PerpetualPositionManagerMultiParty.PositionData;
  using PerpetualLiquidatableMultiPartyLib for PerpetualPositionManagerMultiParty.PositionData;

  using FeePayerPartyLib for FixedPoint.Unsigned;
  using PerpetualPositionManagerMultiPartyLib for PerpetualPositionManagerMultiParty.PositionManagerData;
  using PerpetualLiquidatableMultiPartyLib for PerpetualLiquidatableMultiParty.LiquidationData;
  using PerpetualPositionManagerMultiPartyLib for FixedPoint.Unsigned;

  //----------------------------------------
  // External functions
  //----------------------------------------

  function liquidate(
    PerpetualPositionManagerMultiParty.PositionData storage positionToLiquidate,
    PerpetualPositionManagerMultiParty.PositionManagerData
      storage positionManagerData,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FeePayerParty.FeePayerData storage feePayerData,
    address sponsor,
    FixedPoint.Unsigned calldata numSynthTokens
  )
    external
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    // make sure position is undercollateralised
    (bool isCollateralised, FixedPoint.Unsigned memory maxTokensLiquidatable) =
      positionManagerData._checkCollateralization(
        positionToLiquidate.rawCollateral,
        positionToLiquidate.tokensOutstanding
      );
    require(!isCollateralised, 'Position is properly collateralised');

    // reduce LP position and global position
    FixedPoint.Unsigned memory tokensToLiquidate =
      maxTokensLiquidatable.isGreaterThan(numSynthTokens)
        ? numSynthTokens
        : maxTokensLiquidatable;
    FixedPoint.Unsigned memory collateralLiquidated =
      positionToLiquidate.reducePosition(globalPositionData, tokensToLiquidate);

    // burn tokens
    burnSyntheticTokens(
      sponsor,
      positionManagerData.tokenCurrency,
      tokensToLiquidate.rawValue
    );

    // pay sender with collateral unlocked + TODO rewards
    feePayerData.collateralCurrency.safeTransfer(
      msg.sender,
      collateralLiquidated.rawValue
    );

    // return values + TODO rewards
    return (collateralLiquidated.rawValue, tokensToLiquidate.rawValue, 0);
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------
  function burnSyntheticTokens(
    address owner,
    BaseControlledMintableBurnableERC20 syntheticToken,
    uint256 amount
  ) internal {
    // transfer tokens from owner to here and burn them
    syntheticToken.safeTransferFrom(owner, address(this), amount);
    syntheticToken.burn(amount);
  }

  function reducePosition(
    PerpetualPositionManagerMultiParty.PositionData storage positionToLiquidate,
    PerpetualPositionManagerMultiParty.GlobalPositionData
      storage globalPositionData,
    FixedPoint.Unsigned memory tokensToLiquidate
  ) internal returns (FixedPoint.Unsigned memory collateralUnlocked) {
    // calculate collateral to unlock
    FixedPoint.Unsigned memory fraction =
      tokensToLiquidate.div(positionToLiquidate.tokensOutstanding);
    collateralUnlocked = positionToLiquidate.rawCollateral.mul(fraction);

    // reduce position
    positionToLiquidate.tokensOutstanding = positionToLiquidate
      .tokensOutstanding
      .sub(tokensToLiquidate);
    positionToLiquidate.rawCollateral = positionToLiquidate.rawCollateral.sub(
      collateralUnlocked
    );

    // update global position data
    globalPositionData.totalTokensOutstanding = globalPositionData
      .totalTokensOutstanding
      .sub(tokensToLiquidate);
    globalPositionData.rawTotalPositionCollateral = globalPositionData
      .rawTotalPositionCollateral
      .sub(collateralUnlocked);
  }
}
