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
  mapping(bytes32 => LendingInfo) public idToLendingInfo;
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

  function setLendingModule(LendingInfo memory lendingInfo, string memory id)
    external
    onlyPoolFactory
  {
    idToLendingInfo[keccak256(abi.encode(id))] = lendingInfo;
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
    require(
      idToLendingInfo[poolData.lendingModuleId].lendingModule != address(0),
      'Bad pool'
    );
    require(
      jrtBuybackShare <= 10**18 && daoInterestShare <= 10**18,
      'Invalid share'
    );

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
    bytes32 id = keccak256(abi.encode(lendingID));
    LendingInfo memory lendingInfo = idToLendingInfo[id];
    address lendingModule = lendingInfo.lendingModule;
    require(lendingModule != address(0), 'Id not existent');

    // set pool storage
    PoolStorage storage poolData = poolStorage[pool];
    poolData.collateral = collateral;
    poolData.daoInterestShare = daoInterestShare;
    poolData.JRTBuybackShare = jrtBuybackShare;
    poolData.lendingModuleId = id;
    poolData.interestBearingToken = interestBearingToken == address(0)
      ? ILendingModule(lendingModule).getInterestBearingToken(
        collateral,
        lendingInfo.args
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
    newPoolData.lendingModuleId = oldPoolData.lendingModuleId;
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
  ) external onlyProxy returns (PoolStorage memory, LendingInfo memory) {
    bytes32 id = keccak256(abi.encode(newLendingID));
    LendingInfo memory newLendingInfo = idToLendingInfo[id];
    address newLendingModule = newLendingInfo.lendingModule;
    require(newLendingModule != address(0), 'Id not existent');

    // set lending module
    PoolStorage storage poolData = poolStorage[pool];
    poolData.lendingModuleId = id;
    poolData.interestBearingToken = newInterestToken == address(0)
      ? ILendingModule(newLendingModule).getInterestBearingToken(
        poolData.collateral,
        newLendingInfo.args
      )
      : newInterestToken;

    return (poolStorage[pool], newLendingInfo);
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
    returns (PoolStorage memory poolData, LendingInfo memory lendingInfo)
  {
    poolData = poolStorage[pool];
    lendingInfo = idToLendingInfo[poolData.lendingModuleId];
  }

  function getPoolData(address pool)
    external
    view
    returns (PoolStorage memory poolData)
  {
    poolData = poolStorage[pool];
  }

  function getCollateralSwapModule(address collateral)
    external
    view
    returns (address)
  {
    return collateralToSwapModule[collateral];
  }

  function getInterestBearingToken(address pool)
    external
    view
    returns (address interestTokenAddr)
  {
    interestTokenAddr = poolStorage[pool].interestBearingToken;
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
