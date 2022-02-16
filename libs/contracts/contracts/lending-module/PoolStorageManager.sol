// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;
import {IPoolStorageManager} from './interfaces/IPoolStorageManager.sol';

contract PoolStorageManager is IPoolStorageManager {
  mapping(string => address) public idToLending; // ie 'aave' -> address(AaveModule)
  mapping(address => bytes) lendingToArgs; // info to be decoded in lending module (ie moneyMarket)
  mapping(address => address) collateralToSwapModule; // ie USDC -> JRTSwapUniswap address
  mapping(address => PoolStorage) public poolStorage; // ie jEUR/USDC pooldata

  function setPoolStorage(
    address pool,
    address collateral,
    string memory lendingID,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external {
    address lendingModule = idToLending[lendingID];

    PoolStorage storage poolData = poolStorage[pool];
    poolData.collateral = collateral;
    poolData.daoInterestShare = daoInterestShare;
    poolData.JRTBuybackShare = jrtBuybackShare;
    //TODO retrieve interest baring token
    // poolData.interestBearingToken = interestBearingToken == address(0) ? ILendingProxy(lendingModule) : interestBearingToken;
  }

  function updateValues(
    address pool,
    uint256 collateralDeposited,
    uint256 daoJRT,
    uint256 daoInterest
  ) external {
    PoolStorage storage poolData = poolStorage[pool];

    // update collateral deposit amount of the pool
    poolData.collateralDeposited = collateralDeposited;

    // update dao unclaimed interest of the pool
    poolData.unclaimedDaoJRT = daoJRT;
    poolData.unclaimedDaoCommission = daoInterest;
  }

  function getPoolStorage(address pool)
    external
    view
    returns (PoolStorage memory)
  {
    return poolStorage[pool];
  }

  function getCollateralSwapModule(address collateral)
    external
    view
    returns (address)
  {
    return collateralToSwapModule[collateral];
  }

  function getLendingArgs(address lendingModule)
    external
    view
    returns (bytes memory)
  {
    return lendingToArgs[lendingModule];
  }
}
