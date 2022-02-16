// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

interface IPoolStorageManager {
  struct PoolStorage {
    address lendingModule;
    address collateral;
    address interestBearingToken;
    uint256 collateralDeposited;
    uint256 daoInterestShare;
    uint256 unclaimedDaoJRT;
    uint256 unclaimedDaoCommission;
    uint256 JRTBuybackShare;
  }

  function setPoolStorage(
    address pool,
    address collateral,
    string memory lendingID,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external;

  function updateValues(
    address pool,
    uint256 collateralDeposited,
    uint256 daoJRT,
    uint256 daoInterest
  ) external;

  function getPoolStorage(address pool)
    external
    view
    returns (PoolStorage memory);

  function getCollateralSwapModule(address collateral)
    external
    view
    returns (address);

  function getLendingArgs(address lendingModule)
    external
    view
    returns (bytes memory);
}
