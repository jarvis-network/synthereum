// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface ILendingStorageManager {
  struct PoolStorage {
    bytes32 lendingModuleId;
    address collateral;
    address interestBearingToken;
    uint256 JRTBuybackShare;
    uint256 daoInterestShare;
    uint256 collateralDeposited;
    uint256 unclaimedDaoJRT;
    uint256 unclaimedDaoCommission;
  }

  struct LendingInfo {
    address lendingModule;
    bytes args;
  }

  function setLendingModule(string memory id, LendingInfo memory lendingInfo)
    external;

  function setSwapModule(address collateral, address swapModule) external;

  function setShares(
    address pool,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external;

  function setPoolStorage(
    string memory lendingID,
    address pool,
    address collateral,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external;

  function migratePool(address oldPool, address newPool) external;

  function migrateLendingModule(
    string memory newLendingID,
    address pool,
    address newInterestToken
  ) external returns (PoolStorage memory, LendingInfo memory);

  function updateValues(
    address pool,
    uint256 collateralDeposited,
    uint256 daoJRT,
    uint256 daoInterest
  ) external;

  function getPoolStorage(address pool)
    external
    view
    returns (PoolStorage memory poolData, LendingInfo memory lendingInfo);

  function getPoolData(address pool)
    external
    view
    returns (PoolStorage memory poolData);

  function getCollateralSwapModule(address collateral)
    external
    view
    returns (address);

  function getInterestBearingToken(address pool)
    external
    view
    returns (address interestTokenAddr);
}
