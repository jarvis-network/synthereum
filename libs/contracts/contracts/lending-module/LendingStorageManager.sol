// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  ISynthereumFactoryVersioning
} from '../core/interfaces/IFactoryVersioning.sol';
import {ILendingStorageManager} from './interfaces/ILendingStorageManager.sol';
import {ILendingModule} from './interfaces/ILendingModule.sol';
import {SynthereumInterfaces, FactoryInterfaces} from '../core/Constants.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract LendingStorageManager is ILendingStorageManager, ReentrancyGuard {
  mapping(bytes32 => LendingInfo) public idToLendingInfo;
  mapping(address => address) collateralToSwapModule; // ie USDC -> JRTSwapUniswap address
  mapping(address => PoolStorage) public poolStorage; // ie jEUR/USDC pooldata

  address immutable finder;

  modifier onlyLendingManager() {
    address lendingManager =
      ISynthereumFinder(finder).getImplementationAddress(
        SynthereumInterfaces.LendingManager
      );
    require(msg.sender == lendingManager, 'Not allowed');
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

  function setLendingModule(string memory id, LendingInfo memory lendingInfo)
    external
    nonReentrant
    onlyLendingManager
  {
    bytes32 lendingId = keccak256(abi.encode(id));
    require(lendingId != 0x00, 'Wrong module identifier');
    idToLendingInfo[lendingId] = lendingInfo;
  }

  function setSwapModule(address collateral, address swapModule)
    external
    nonReentrant
    onlyLendingManager
  {
    collateralToSwapModule[collateral] = swapModule;
  }

  function setShares(
    address pool,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external nonReentrant onlyLendingManager {
    PoolStorage storage poolData = poolStorage[pool];
    require(poolData.lendingModuleId != 0x00, 'Bad pool');
    require(
      jrtBuybackShare <= PreciseUnitMath.PRECISE_UNIT &&
        daoInterestShare <= PreciseUnitMath.PRECISE_UNIT,
      'Invalid share'
    );

    poolData.JRTBuybackShare = jrtBuybackShare;
    poolData.daoInterestShare = daoInterestShare;
  }

  function setPoolStorage(
    string memory lendingID,
    address pool,
    address collateral,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external nonReentrant onlyPoolFactory {
    bytes32 id = keccak256(abi.encode(lendingID));
    LendingInfo memory lendingInfo = idToLendingInfo[id];
    address lendingModule = lendingInfo.lendingModule;
    require(lendingModule != address(0), 'Id not existent');
    require(
      jrtBuybackShare <= PreciseUnitMath.PRECISE_UNIT &&
        daoInterestShare <= PreciseUnitMath.PRECISE_UNIT,
      'Invalid share'
    );

    // set pool storage
    PoolStorage storage poolData = poolStorage[pool];
    require(poolData.lendingModuleId == 0x00, 'Pool already exists');
    poolData.lendingModuleId = id;
    poolData.collateral = collateral;
    poolData.JRTBuybackShare = jrtBuybackShare;
    poolData.daoInterestShare = daoInterestShare;

    // set interest bearing token
    try
      ILendingModule(lendingModule).getInterestBearingToken(
        collateral,
        lendingInfo.args
      )
    returns (address interestTokenAddr) {
      poolData.interestBearingToken = interestTokenAddr;
    } catch {
      require(interestBearingToken != address(0), 'No bearing token passed');
      poolData.interestBearingToken = interestBearingToken;
    }
  }

  function migratePool(address oldPool, address newPool)
    external
    nonReentrant
    onlyPoolFactory
  {
    PoolStorage memory oldPoolData = poolStorage[oldPool];
    bytes32 oldLendingId = oldPoolData.lendingModuleId;
    require(oldLendingId != 0x00, 'Bad migration pool');

    PoolStorage storage newPoolData = poolStorage[newPool];
    require(newPoolData.lendingModuleId == 0x00, 'Bad new pool');

    // copy storage to new pool
    newPoolData.lendingModuleId = oldLendingId;
    newPoolData.collateral = oldPoolData.collateral;
    newPoolData.interestBearingToken = oldPoolData.interestBearingToken;
    newPoolData.JRTBuybackShare = oldPoolData.JRTBuybackShare;
    newPoolData.daoInterestShare = oldPoolData.daoInterestShare;
    newPoolData.collateralDeposited = oldPoolData.collateralDeposited;
    newPoolData.unclaimedDaoJRT = oldPoolData.unclaimedDaoJRT;
    newPoolData.unclaimedDaoCommission = oldPoolData.unclaimedDaoCommission;

    // delete old pool slot
    delete poolStorage[oldPool];
  }

  function migrateLendingModule(
    string memory newLendingID,
    address pool,
    address newInterestBearingToken
  )
    external
    nonReentrant
    onlyLendingManager
    returns (PoolStorage memory, LendingInfo memory)
  {
    bytes32 id = keccak256(abi.encode(newLendingID));
    LendingInfo memory newLendingInfo = idToLendingInfo[id];
    address newLendingModule = newLendingInfo.lendingModule;
    require(newLendingModule != address(0), 'Id not existent');

    // set lending module
    PoolStorage storage poolData = poolStorage[pool];
    poolData.lendingModuleId = id;

    // set interest bearing token
    try
      ILendingModule(newLendingModule).getInterestBearingToken(
        poolData.collateral,
        newLendingInfo.args
      )
    returns (address interestTokenAddr) {
      poolData.interestBearingToken = interestTokenAddr;
    } catch {
      require(newInterestBearingToken != address(0), 'No bearing token passed');
      poolData.interestBearingToken = newInterestBearingToken;
    }

    return (poolStorage[pool], newLendingInfo);
  }

  function updateValues(
    address pool,
    uint256 collateralDeposited,
    uint256 daoJRT,
    uint256 daoInterest
  ) external nonReentrant onlyLendingManager {
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
