// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface ISynthereumMultiLpLiquidityPoolEvents {
  /**
   * @notice Emitted when a LP is registered in the pool by the maintainer
   * @param lp Address of the LP to be registered
   */
  event RegisteredLp(address indexed lp);

  /**
   * @notice Emitted when a LP is activated in the pool by himself
   * @param lp Address of the LP to be activated
   */
  event ActivatedLP(address indexed lp);

  /**
   * @notice Emitted when a LP set his overCollateralization
   * @param lp Address of the LP to set overCollateralization
   * @param overCollateralization OverCollateralization percentage set
   */
  event SetOvercollateralization(
    address indexed lp,
    uint256 overCollateralization
  );

  /**
   * @notice Emitted when a LP deposits collateral
   * @param lp Address of the LP depositing
   * @param collateralSent Collateral sent to the the pool by the LP
   * @param collateralDeposited Net collateral amount added to the LP position
   */
  event DepositedLiquidity(
    address indexed lp,
    uint256 collateralSent,
    uint256 collateralDeposited
  );

  /**
   * @notice Emitted when a LP withdraws collateral
   * @param lp Address of the LP withdrawing
   * @param collateralReceived Collateral received from the pool by the LP
   * @param collateralWithdrawn Net collateral amount removed from the LP position
   */
  event WithdrawnLiquidity(
    address indexed lp,
    uint256 collateralReceived,
    uint256 collateralWithdrawn
  );

  /**
   * @notice Emitted when new fee percentage is set in the pool by the maintainer
   * @param newFee New fee percentage
   */
  event SetFeePercentage(uint256 newFee);

  /**
   * @notice Emitted when liquidation reward percentage is set in the pool by the maintainer
   * @param newLiquidationReward New liquidation reward percentage
   */
  event SetLiquidationReward(uint256 newLiquidationReward);
}
