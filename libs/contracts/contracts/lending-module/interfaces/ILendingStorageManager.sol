// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

interface ILendingStorageManager {
  struct PoolStorage {
    address lendingModule;
    address collateral;
    address interestBearingToken;
    uint256 JRTBuybackShare;
    uint256 daoInterestShare;
    uint256 collateralDeposited;
    uint256 unclaimedDaoJRT;
    uint256 unclaimedDaoCommission;
  }

  function setLendingModule(
    address lendingModule,
    bytes memory args,
    string memory id
  ) external;

  function setSwapModule(address swapModule, address collateral) external;

  function setShares(
    address pool,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external;

  function setPoolStorage(
    address pool,
    address collateral,
    string memory lendingID,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external;

  function migratePool(address oldPool, address newPool) external;

  function migrateLendingModule(
    address pool,
    string memory newLendingID,
    address newInterestToken
  ) external returns (PoolStorage memory);

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
