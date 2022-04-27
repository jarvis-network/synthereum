// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ILendingStorageManager} from './ILendingStorageManager.sol';

interface ILendingModule {
  struct ReturnValues {
    uint256 totalInterest; // total accumulated interest of the pool since last state-changing operation
    uint256 tokensOut; //amount of tokens received from money market (before eventual fees)
    uint256 tokensTransferred; //amount of tokens finally transfered from money market (after eventual fees)
  }

  /**
   * @notice deposits collateral into the money market
   * @dev calculates and return the generated interest since last state-changing operation
   * @param poolData pool storage information
   * @param lendingArgs encoded args needed by the specific implementation
   * @param amount of collateral to deposit
   * @param recipient address receiving the interest token from money market
   * @return totalInterest check ReturnValues struct
   * @return tokensOut check ReturnValues struct
   * @return tokensTransferred check ReturnValues struct
   */
  function deposit(
    ILendingStorageManager.PoolStorage calldata poolData,
    bytes memory lendingArgs,
    uint256 amount,
    address recipient
  )
    external
    returns (
      uint256 totalInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    );

  /**
   * @notice withdraw collateral from the money market
   * @dev calculates and return the generated interest since last state-changing operation
   * @param poolData pool storage information
   * @param pool pool address to calculate interest on
   * @param lendingArgs encoded args needed by the specific implementation
   * @param amount of interest tokens to redeem
   * @param recipient address receiving the collateral from money market
   * @return totalInterest check ReturnValues struct
   * @return tokensOut check ReturnValues struct
   * @return tokensTransferred check ReturnValues struct
   */
  function withdraw(
    ILendingStorageManager.PoolStorage calldata poolData,
    address pool,
    bytes memory lendingArgs,
    uint256 amount,
    address recipient
  )
    external
    returns (
      uint256 totalInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    );

  /**
   * @notice returns accumulated interest of a pool since state-changing last operation
   * @dev does not update state
   * @param poolAddress reference pool to check accumulated interest
   * @param poolData pool storage information
   * @param extraArgs encoded args the ILendingModule implementer might need. see ILendingManager.LendingInfo struct
   * @return totalInterest total amount of interest accumulated
   */
  function getAccumulatedInterest(
    address poolAddress,
    ILendingStorageManager.PoolStorage calldata poolData,
    bytes memory extraArgs
  ) external view returns (uint256 totalInterest);

  function getInterestBearingToken(address collateral, bytes memory args)
    external
    view
    returns (address token);

  /**
   * @notice returns the conversion between collateral and interest token of a specific money market
   * @param collateralAmount amount of collateral to calculate conversion on
   * @param collateral address of collateral token
   * @param interestToken address of interest token
   * @param extraArgs encoded args the ILendingModule implementer might need. see ILendingManager.LendingInfo struct
   * @return interestTokenAmount amount of interest token after conversion
   */
  function collateralToInterestToken(
    uint256 collateralAmount,
    address collateral,
    address interestToken,
    bytes memory extraArgs
  ) external view returns (uint256 interestTokenAmount);

  /**
   * @notice returns the conversion between interest token and collateral of a specific money market
   * @param interestTokenAmount amount of interest token to calculate conversion on
   * @param collateral address of collateral token
   * @param interestToken address of interest token
   * @param extraArgs encoded args the ILendingModule implementer might need. see ILendingManager.LendingInfo struct
   * @return collateralAmount amount of collateral token after conversion
   */
  function interestTokenToCollateral(
    uint256 interestTokenAmount,
    address collateral,
    address interestToken,
    bytes memory extraArgs
  ) external view returns (uint256 collateralAmount);
}
