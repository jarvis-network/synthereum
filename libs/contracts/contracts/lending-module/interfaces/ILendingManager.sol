// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ILendingStorageManager} from './ILendingStorageManager.sol';

interface ILendingManager {
  struct Roles {
    address admin;
    address maintainer;
  }

  struct ReturnValues {
    uint256 poolInterest; //accumulated pool interest since last state-changing operation;
    uint256 daoInterest; //acccumulated dao interest since last state-changing operation;
    uint256 tokensOut; //amount of tokens received from money market (including eventual fees)
    uint256 tokensTransferred; //amount of tokens finally transfered from money market (after eventual fees)
  }

  struct InterestSplit {
    uint256 poolInterest; // share of the total interest generated to the LPs;
    uint256 jrtInterest; // share of the total interest generated for jrt buyback;
    uint256 commissionInterest; // share of the total interest generated as dao commission;
  }

  struct MigrateReturnValues {
    uint256 prevDepositedCollateral;
    uint256 poolInterest;
    uint256 actualCollateralDeposited;
    // prevDepositedCollateral collateral deposited (without last interests) before the migration
    // poolInterests collateral interests accumalated before the migration
    // actualCollateralDeposited collateral deposited after the migration
  }

  /**
   * @notice deposits collateral into the pool's associated money market
   * @dev calculates and return the generated interest since last state-changing operation
   * @param collateralAmount amount of collateral to deposit
   * @param recipient the address receiving the interest tokens from money market
   * @return returnValues check struct
   */
  function deposit(uint256 collateralAmount, address recipient)
    external
    returns (ReturnValues memory returnValues);

  /**
   * @notice withdraw collateral from the pool's associated money market
   * @dev calculates and return the generated interest since last state-changing operation
   * @param interestTokenAmount amount of interest tokens to redeem
   * @param recipient the address receiving the collateral from money market
   * @return returnValues check struct
   */
  function withdraw(uint256 interestTokenAmount, address recipient)
    external
    returns (ReturnValues memory returnValues);

  /**
   * @notice calculate, split and update the generated interest of the caller pool since last state-changing operation
   * @return returnValues check struct
   */
  function updateAccumulatedInterest()
    external
    returns (ReturnValues memory returnValues);

  /**
   * @notice batches calls to redeem poolData.commissionInterest from multiple pools
   * @dev calculates and return the generated interest since last state-changing operation
   * @param pools array of pools to redeem commissions from
   * @param collateralAmounts array of amount of commission to redeem for each pool (matching pools order)
   */
  function batchClaimCommission(
    address[] memory pools,
    uint256[] memory collateralAmounts
  ) external;

  // TODO batching
  function executeBuyback(uint256 collateralAmount, bytes memory swapParams)
    external
    returns (ReturnValues memory returnValues);

  /**
   * @notice sets the address of the implementation of a lending module and its extraBytes
   * @param id associated to the lending module to be set
   * @param lendingInfo see lendingInfo struct
   */
  function setLendingModule(
    string memory id,
    ILendingStorageManager.LendingInfo memory lendingInfo
  ) external;

  /**
   * @notice sets an address as the swap module associated to a specific collateral
   * @dev the swapModule must implement the IJRTSwapModule interface
   * @param collateral collateral address associated to the swap module
   * @param swapModule IJRTSwapModule implementer contract
   */
  function setSwapModule(address collateral, address swapModule) external;

  /**
   * @notice set shares on interest generated by a pool collateral on the lending storage manager
   * @param pool pool address to set shares on
   * @param daoInterestShare share of total interest generated assigned to the dao
   * @param jrtBuybackShare share of the total dao interest used to buyback jrt from an AMM
   */
  function setShares(
    address pool,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external;

  /**
   * @notice migrates liquidity from one lending module (and money market), to a new one
   * @dev calculates and return the generated interest since last state-changing operation.
   * @dev The new lending module info must be have been previously set in the storage manager
   * @param newLendingID id associated to the new lending module info
   * @param newInterestBearingToken address of the interest token of the new money market
   * @param interestTokenAmount total amount of interest token to migrate from old to new money market
   * @return migrateReturnValues check struct
   */
  function migrateLendingModule(
    string memory newLendingID,
    address newInterestBearingToken,
    uint256 interestTokenAmount
  ) external returns (MigrateReturnValues memory);

  /**
   * @notice returns the conversion between collateral and interest token of a specific money market
   * @dev isExactTransfer indicates if the collateral has to be treated like exactInput or exactOutput
   * @dev considering potential money market fees that must be charged to the tx caller
   * @param pool reference pool to check conversion
   * @param collateralAmount amount of collateral to calculate conversion on
   * @param isExactTransfer indicates if the collateral has to be treated like exactInput or exactOutput
   * @return interestTokenAmount amount of interest token after conversion
   * @return interestTokenAddr address of the pool associated interest token
   */
  function collateralToInterestToken(
    address pool,
    uint256 collateralAmount,
    bool isExactTransfer
  )
    external
    view
    returns (uint256 interestTokenAmount, address interestTokenAddr);

  /**
   * @notice returns accumulated interest of a pool since state-changing last operation
   * @dev does not update state
   * @param pool reference pool to check accumulated interest
   * @return poolInterest amount of interest generated for the pool after splitting the dao share
   * @return collateralDeposited total amount of collateral currently deposited by the pool
   */
  function getAccumulatedInterest(address pool)
    external
    view
    returns (uint256 poolInterest, uint256 collateralDeposited);
}
