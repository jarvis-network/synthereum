// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {
  StandardAccessControlEnumerable
} from '../../common/roles/StandardAccessControlEnumerable.sol';
import {
  IJarvisBuybackVault
} from '../../jarvis-token/interfaces/IBuybackVault.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IPoolVault {
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
    StandardAccessControlEnumerable.Roles roles;
    // The fee percentage
    uint64 fee;
    // Identifier of price to be used in the price feed
    bytes32 priceIdentifier;
    // Percentage of overcollateralization to which a liquidation can triggered
    uint128 overCollateralRequirement;
    // Percentage of reward for correct liquidation by a liquidator
    uint64 liquidationReward;
    // Name of the lending protocol used
    string lendingModuleId;
    // Buyback vault associated to the pool
    IJarvisBuybackVault buybackVault;
  }

  struct LPInfo {
    // Actual collateral owned
    uint256 actualCollateralAmount;
    // Number of tokens collateralized
    uint256 tokensCollateralized;
    // Overcollateralization percentage
    uint256 overCollateralization;
    // Actual Lp capacity of the Lp in synth asset  (actualCollateralAmount/overCollateralization) * price - numTokens
    uint256 capacity;
    // Utilization ratio: (numTokens * price_inv * overCollateralization) / actualCollateralAmount
    uint256 utilization;
    // Collateral coverage: (actualCollateralAmount + numTokens * price_inv) / (numTokens * price_inv)
    uint256 coverage;
    // Mint shares percentage
    uint256 mintShares;
    // Redeem shares percentage
    uint256 redeemShares;
    // Interest shares percentage
    uint256 interestShares;
    // True if it's overcollateralized, otherwise false
    bool isOvercollateralized;
  }

  /**
   * @notice Returns the LP parametrs info
   * @notice Mint, redeem and intreest shares are round down (division dust not included)
   * @param _lp Address of the LP
   * @return info Info of the input LP (see LPInfo struct)
   */
  function positionLPInfo(address _lp)
    external
    view
    returns (LPInfo memory info);

  /**
   * @notice Add collateral to an active LP position
   * @notice Only an active LP can call this function to add collateral to his position
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @return collateralDeposited Net collateral deposited in the LP position
   * @return newLpCollateralAmount Amount of collateral of the LP after the increase
   */
  function addLiquidity(uint256 _collateralAmount)
    external
    returns (uint256 collateralDeposited, uint256 newLpCollateralAmount);

  /**
   * @notice Add the Lp to the active list of the LPs and initialize collateral and overcollateralization
   * @notice Only a registered and inactive LP can call this function to add himself
   * @param _collateralAmount Collateral amount to deposit by the LP
   * @param _overCollateralization Overcollateralization to set by the LP
   * @return collateralDeposited Net collateral deposited in the LP position
   */
  function activateLP(uint256 _collateralAmount, uint128 _overCollateralization)
    external
    returns (uint256 collateralDeposited);

  /**
   * @notice Withdraw collateral from an active LP position
   * @notice Only an active LP can call this function to withdraw collateral from his position
   * @param _collateralAmount Collateral amount to withdraw by the LP
   * @return collateralRemoved Net collateral decreased form the position
   * @return collateralReceived Collateral received from the withdrawal
   * @return newLpCollateralAmount Amount of collateral of the LP after the decrease
   */
  function removeLiquidity(uint256 _collateralAmount)
    external
    returns (
      uint256 collateralRemoved,
      uint256 collateralReceived,
      uint256 newLpCollateralAmount
    );

  /**
   * @notice Get the collateral token of this pool/self-minting derivative
   * @return collateralCurrency The ERC20 collateral token
   */
  function collateralToken() external view returns (IERC20 collateralCurrency);
}
