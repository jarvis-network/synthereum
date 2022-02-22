// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  ISynthereumFactoryVersioning
} from '../core/interfaces/IFactoryVersioning.sol';
import {ILendingStorageManager} from './interfaces/ILendingStorageManager.sol';
import {ILendingModule} from './interfaces/ILendingModule.sol';
import {SynthereumInterfaces, FactoryInterfaces} from '../core/Constants.sol';

contract LendingStorageManager is ILendingStorageManager {
  mapping(string => address) public idToLending; // ie 'aave' -> address(AaveModule)
  mapping(address => bytes) lendingToArgs; // info to be decoded in lending module (ie moneyMarket)
  mapping(address => address) collateralToSwapModule; // ie USDC -> JRTSwapUniswap address
  mapping(address => PoolStorage) public poolStorage; // ie jEUR/USDC pooldata

  address immutable finder;

  modifier onlyProxy() {
    address proxy =
      ISynthereumFinder(finder).getImplementationAddress(
        SynthereumInterfaces.LendingManager
      );
    require(msg.sender == proxy, 'Not allowed');
    _;
  }

  modifier onlyPoolFactory() {
    ISynthereumFactoryVersioning factoryVersioning =
      ISynthereumFactoryVersioning(
        ISynthereumFinder(finder).getImplementationAddress(
          SynthereumInterfaces.FactoryVersioning
        )
      );
    uint8 numberOfPoolFactories =
      factoryVersioning.numberOfFactoryVersions(FactoryInterfaces.PoolFactory);
    require(
      _checkSenderIsFactory(
        factoryVersioning,
        numberOfPoolFactories,
        FactoryInterfaces.PoolFactory
      ),
      'Not allowed'
    );
    _;
  }

  constructor(address _finder) {
    finder = _finder;
  }

  function setLendingModule(
    address lendingModule,
    bytes memory args,
    string memory id
  ) external onlyProxy {
    idToLending[id] = lendingModule;
    lendingToArgs[lendingModule] = args;
  }

  function setSwapModule(address swapModule, address collateral)
    external
    onlyProxy
  {
    collateralToSwapModule[collateral] = swapModule;
  }

  function setShares(
    address pool,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external onlyProxy {
    PoolStorage storage poolData = poolStorage[pool];
    require(poolData.lendingModule != address(0), 'Bad pool');

    poolData.JRTBuybackShare = jrtBuybackShare;
    poolData.daoInterestShare = daoInterestShare;
  }

  function setPoolStorage(
    address pool,
    address collateral,
    string memory lendingID,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external onlyPoolFactory {
    address lendingModule = idToLending[lendingID];
    require(lendingModule != address(0), 'Id not existent');

    // set pool storage
    PoolStorage storage poolData = poolStorage[pool];
    poolData.collateral = collateral;
    poolData.daoInterestShare = daoInterestShare;
    poolData.JRTBuybackShare = jrtBuybackShare;
    poolData.lendingModule = lendingModule;
    poolData.interestBearingToken = interestBearingToken == address(0)
      ? ILendingModule(lendingModule).getInterestBearingToken(
        collateral,
        address(this)
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
    string memory newLendingID,
    address newInterestToken
  ) external onlyProxy returns (PoolStorage memory) {
    address newLendingModule = idToLending[newLendingID];
    require(newLendingModule != address(0), 'Id not existent');

    // set lending module
    PoolStorage storage poolData = poolStorage[pool];
    poolData.lendingModule = newLendingModule;
    poolData.interestBearingToken = newInterestToken == address(0)
      ? ILendingModule(newLendingModule).getInterestBearingToken(
        poolData.collateral,
        address(this)
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

  function _checkSenderIsFactory(
    ISynthereumFactoryVersioning factoryVersioning,
    uint8 numberOfFactories,
    bytes32 factoryKind
  ) internal view returns (bool isFactory) {
    uint8 counterFactory;
    for (uint8 i = 0; counterFactory < numberOfFactories; i++) {
      try factoryVersioning.getFactoryVersion(factoryKind, i) returns (
        address factory
      ) {
        if (msg.sender == factory) {
          isFactory = true;
          break;
        } else {
          counterFactory++;
          if (counterFactory == numberOfFactories) {
            isFactory = false;
          }
        }
      } catch {}
    }
  }
}
