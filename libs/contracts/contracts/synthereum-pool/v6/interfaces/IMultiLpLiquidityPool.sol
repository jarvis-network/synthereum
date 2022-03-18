// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ITypology} from '../../../common/interfaces/ITypology.sol';
import {IStandardERC20} from '../../../base/interfaces/IStandardERC20.sol';
import {
  IMintableBurnableERC20
} from '../../../tokens/interfaces/IMintableBurnableERC20.sol';
import {
  ISynthereumDeployment
} from '../../../common/interfaces/IDeployment.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';

/**
 * @title Multi LP pool interface
 */
interface ISynthereumMultiLpLiquidityPool is ITypology, ISynthereumDeployment {
  // Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  struct InitializationParams {
    // Synthereum finder
    ISynthereumFinder finder;
    // Synthereum pool version
    uint8 version;
    // ERC20 collateral token
    IStandardERC20 collateralToken;
    // ERC20 synthetic token
    IMintableBurnableERC20 syntheticToken;
    // The addresses of admin and maintainer
    Roles roles;
    // The fee percentage
    uint256 fee;
    // Identifier of price to be used in the price feed
    bytes32 priceIdentifier;
    // Percentage of overcollateralization to which a liquidation can triggered
    uint256 overCollateralRequirement;
    // Percentage of reward for correct liquidation by a liquidator
    uint256 liquidationReward;
  }

  struct LPPosition {
    // Actual collateral owned
    uint256 actualCollateralAmount;
    // Number of tokens collateralized
    uint256 tokensCollateralized;
    // Overcollateralization percentage
    uint256 overCollateralization;
  }

  struct MintParams {
    // Minimum amount of synthetic tokens that a user wants to mint using collateral (anti-slippage)
    uint256 minNumTokens;
    // Amount of collateral that a user wants to spend for minting
    uint256 collateralAmount;
    // Expiration time of the transaction
    uint256 expiration;
    // Address to which send synthetic tokens minted
    address recipient;
  }

  struct RedeemParams {
    // Amount of synthetic tokens that user wants to use for redeeming
    uint256 numTokens;
    // Minimium amount of collateral that user wants to redeem (anti-slippage)
    uint256 minCollateral;
    // Expiration time of the transaction
    uint256 expiration;
    // Address to which send collateral tokens redeemed
    address recipient;
  }

  struct LPInfo {
    // Actual collateral owned
    uint256 actualCollateralAmount;
    // Number of tokens collateralized
    uint256 tokensCollateralized;
    // Overcollateralization percentage
    uint256 overCollateralization;
    // Available liquidity for minting
    uint256 availableLiquidity;
    // Utilization ratio: (numTokens * price * overCollateralization) / actualCollateralAmount
    uint256 utilization;
    // Collateral coverage: (actualCollateralAmount + numTokens * price) / (numTokens * price)
    uint256 coverage;
    // Mint shares percentage
    uint256 mintShares;
    // Redeem shares percentage
    uint256 redeemShares;
    // True if it's overcollateralized, otherwise false
    bool isOvercollateralized;
  }

  /**
   * @notice Initialize pool
   * @param _params Params used for initialization (see InitializationParams struct)
   */
  function initialize(InitializationParams memory _params) external;

  /**
   * @notice Register a liquidity provider to the LP's whitelist
   * @notice This can be called only by the maintainer
   * @param _lp Address of the LP
   */
  function registerLP(address _lp) external;

  /**
   * @notice Add the Lp to the active list of the LPs and initialize collateral and overcollateralization
   * @notice Only a registered and inactive LP can call this function to add himself
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @param _overCollateralization Overcollateralization to set by the LP
   * @return collateralDeposited Net collateral deposited in the LP position
   */
  function activateLP(uint256 _collateralAmount, uint256 _overCollateralization)
    external
    returns (uint256 collateralDeposited);

  /**
   * @notice Add collateral to an active LP position
   * @notice Only an active LP can call this function to add collateral to his position
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @return collateralDeposited Net collateral deposited in the LP position
   */
  function addLiquidity(uint256 _collateralAmount)
    external
    returns (uint256 collateralDeposited);

  /**
   * @notice Withdraw collateral from an active LP position
   * @notice Only an active LP can call this function to withdraw collateral from his position
   * @param _collateralAmount Collateral amount to withdraw by the LP
   * @param collateralWithdrawn Net collateral withdrawn from the LP position
   */
  function removeLiquidity(uint256 _collateralAmount)
    external
    returns (uint256 collateralWithdrawn);

  /**
   * @notice Mint synthetic tokens using fixed amount of collateral
   * @notice This calculate the price using on chain price feed
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param mintParams Input parameters for minting (see MintParams struct)
   * @return syntheticTokensMinted Amount of synthetic tokens minted by a user
   * @return feePaid Amount of collateral paid by the user as fee
   */
  function mint(MintParams calldata mintParams)
    external
    returns (uint256 syntheticTokensMinted, uint256 feePaid);

  /**
   * @notice Redeem amount of collateral using fixed number of synthetic token
   * @notice This calculate the price using on chain price feed
   * @notice User must approve synthetic token transfer for the redeem request to succeed
   * @param redeemParams Input parameters for redeeming (see RedeemParams struct)
   * @return collateralRedeemed Amount of collateral redeem by user
   * @return feePaid Amount of collateral paid by user as fee
   */
  function redeem(RedeemParams calldata redeemParams)
    external
    returns (uint256 collateralRedeemed, uint256 feePaid);

  /**
   * @notice Liquidate Lp position for an amount of synthetic tokens undercollateralized
   * @notice Revert if position is not undercollateralized
   * @param lp LP that the the user wants to liquidate
   * @param numSynthTokens Number of synthetic tokens that user wants to liquidate
   * @return Amount of collateral received (Amount of collateral + bonus)
   */
  function liquidate(address lp, uint256 numSynthTokens)
    external
    returns (uint256);

  /**
   * @notice Set the overCollateralization by an active LP
   * @notice This can be called only by an active LP
   * @param _overCollateralization New overCollateralizations
   */
  function setOvercollateralization(uint256 _overCollateralization) external;

  /**
   * @notice Set new liquidation reward percentage
   * @notice This can be called only by the maintainer
   * @param _newLiquidationReward New liquidation reward percentage
   */
  function setLiquidationReward(uint256 _newLiquidationReward) external;

  /**
   * @notice Set new fee percentage
   * @notice This can be called only by the maintainer
   * @param _fee New fee percentage
   */
  function setFee(uint256 _fee) external;

  /**
   * @notice Transfer a bearing amount to the lending manager
   * @notice Only the lending manager can call the function
   * @param _bearingAmount Amount of bearing token to transfer
   */
  function transferToLendingManager(uint256 _bearingAmount) external;

  /**
   * @notice Get all the registered LPs of this pool
   * @return lps The list of addresses of all the registered LPs in the pool.
   */
  function getRegisteredLPs() external view returns (address[] memory lps);

  /**
   * @notice Get all the active LPs of this pool
   * @return lps The list of addresses of all the active LPs in the pool.
   */
  function getActiveLPs() external view returns (address[] memory lps);

  /**
   * @notice Check if the input LP is registered
   * @param _lp Address of the LP
   * @return isRegistered Return true if the LP is regitered, otherwise false
   */
  function isRegisteredLP(address _lp)
    external
    view
    returns (bool isRegistered);

  /**
   * @notice Check if the input LP is active
   * @param _lp Address of the LP
   * @return isActive Return true if the LP is active, otherwise false
   */
  function isActiveLP(address _lp) external view returns (bool isActive);

  /**
   * @notice Returns total number of synthetic tokens generated by this pool
   * @return totalTokens Number of total synthetic tokens in the pool
   */
  function totalSyntheticTokens() external view returns (uint256 totalTokens);

  /**
   * @notice Returns the total amounts of collateral
   * @return usersCollateral Total collateral amount currently holded by users
   * @return lpsCollateral Total collateral amount currently holded by LPs
   * @return totalCollateral Total collateral amount currently holded by users + LPs
   */
  function totalCollateralAmount()
    external
    view
    returns (
      uint256 usersCollateral,
      uint256 lpsCollateral,
      uint256 totalCollateral
    );

  /**
   * @notice Returns the total available liquidity of the LPs
   * @return totalLiquidity Total available liquidity for minting operation
   */
  function totalAvailableLiquidity()
    external
    view
    returns (uint256 totalLiquidity);

  /**
   * @notice Returns the LP parametrs info
   * @return info Info of the input lp (see LPInfo struct)
   */
  function lpInfo(address _lp) external view returns (LPInfo memory info);

  /**
   * @notice Returns the percentage of overcollateralization to which a liquidation can triggered
   * @return requirement Thresold percentage on a liquidation can be triggered
   */
  function collateralRequirement() external view returns (uint256 requirement);

  /**
   * @notice Returns the percentage of reward for correct liquidation by a liquidator
   * @return reward Percentage of reward
   */
  function liquidationReward() external view returns (uint256 reward);

  /**
   * @notice Returns price identifier of the pool
   * @return identifier Price identifier
   */
  function priceFeedIdentifier() external view returns (bytes32 identifier);

  /**
   * @notice Returns fee percentage of the pool
   * @return fee Fee percentage
   */
  function feePercentage() external view returns (uint256 fee);
}
