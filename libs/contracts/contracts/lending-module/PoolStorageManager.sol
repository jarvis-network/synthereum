// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {IPoolStorageManager} from './interfaces/IPoolStorageManager.sol';
import {ILendingModule} from './interfaces/ILendingModule.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';

contract PoolStorageManager is IPoolStorageManager {
  mapping(string => address) public idToLending; // ie 'aave' -> address(AaveModule)
  mapping(address => bytes) lendingToArgs; // info to be decoded in lending module (ie moneyMarket)
  mapping(address => address) collateralToSwapModule; // ie USDC -> JRTSwapUniswap address
  mapping(address => PoolStorage) public poolStorage; // ie jEUR/USDC pooldata

  address immutable finder;

  modifier onlyProxy() {
    address proxy =
      ISynthereumFinder(finder).getImplementationAddress(
        SynthereumInterfaces.LendingProxy
      );
    require(msg.sender == proxy, 'Not allowed');
    _;
  }

  constructor(address _finder) {
    finder = _finder;
  }

  function setLendingModule(address lendingModule, string memory id)
    external
    onlyProxy
  {
    idToLending[id] = lendingModule;
  }

  function setPoolStorage(
    address pool,
    address collateral,
    string memory lendingID,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external onlyProxy {
    address lendingModule = idToLending[lendingID];

    PoolStorage storage poolData = poolStorage[pool];
    poolData.collateral = collateral;
    poolData.daoInterestShare = daoInterestShare;
    poolData.JRTBuybackShare = jrtBuybackShare;
    poolData.lendingModule = lendingModule;
    poolData.interestBearingToken = interestBearingToken == address(0)
      ? ILendingModule(lendingModule).getInterestBearingToken(
        collateral,
        address(this),
        lendingModule
      )
      : interestBearingToken;
  }

  function migratePool(address oldPool, address newPool) external onlyProxy {
    PoolStorage memory oldPoolData = poolStorage[oldPool];
    PoolStorage storage newPoolData = poolStorage[newPool];

    // copy storage to new pool
    newPoolData.collateral = oldPoolData.collateral;
    newPoolData.daoInterestShare = oldPoolData.daoInterestShare;
    newPoolData.JRTBuybackShare = oldPoolData.JRTBuybackShare;
    newPoolData.lendingModule = oldPoolData.lendingModule;
    newPoolData.interestBearingToken = oldPoolData.interestBearingToken;
    newPoolData.collateralDeposited = oldPoolData.collateralDeposited;
    newPoolData.unclaimedDaoCommission = oldPoolData.unclaimedDaoCommission;
    newPoolData.unclaimedDaoJRT = oldPoolData.unclaimedDaoJRT;

    // delete old pool slot
    delete poolStorage[oldPool];
  }

  function migrateLendingModule(
    address pool,
    address newLendingModule,
    address newInterestToken
  ) external onlyProxy returns (PoolStorage memory) {
    PoolStorage storage poolData = poolStorage[pool];
    poolData.lendingModule = newLendingModule;
    poolData.interestBearingToken = newInterestToken == address(0)
      ? ILendingModule(newLendingModule).getInterestBearingToken(
        poolData.collateral,
        address(this),
        poolData.lendingModule
      )
      : newInterestToken;

    return poolStorage[pool];
  }

  function updateValues(
    address pool,
    uint256 collateralDeposited,
    uint256 daoJRT,
    uint256 daoInterest
  ) external onlyProxy {
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
