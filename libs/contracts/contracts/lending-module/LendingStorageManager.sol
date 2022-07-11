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
import {SynthereumFactoryAccess} from '../common/libs/FactoryAccess.sol';
import {
  EnumerableSet
} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract LendingStorageManager is ILendingStorageManager, ReentrancyGuard {
  using EnumerableSet for EnumerableSet.AddressSet;

  mapping(bytes32 => LendingInfo) internal idToLendingInfo;
  EnumerableSet.AddressSet internal swapModules;
  mapping(address => address) internal collateralToSwapModule; // ie USDC -> JRTSwapUniswap address
  mapping(address => PoolStorage) internal poolStorage; // ie jEUR/USDC pooldata

  ISynthereumFinder immutable synthereumFinder;

  modifier onlyLendingManager() {
    address lendingManager =
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.LendingManager
      );
    require(msg.sender == lendingManager, 'Not allowed');
    _;
  }

  modifier onlyPoolFactory() {
    SynthereumFactoryAccess._onlyPoolFactory(synthereumFinder);
    _;
  }

  constructor(ISynthereumFinder _finder) {
    synthereumFinder = _finder;
  }

  function setLendingModule(string memory id, LendingInfo memory lendingInfo)
    external
    override
    nonReentrant
    onlyLendingManager
  {
    bytes32 lendingId = keccak256(abi.encode(id));
    require(lendingId != 0x00, 'Wrong module identifier');
    idToLendingInfo[lendingId] = lendingInfo;
  }

  function addSwapProtocol(address _swapModule)
    external
    override
    nonReentrant
    onlyLendingManager
  {
    require(_swapModule != address(0), 'Swap module can not be 0x');
    require(swapModules.add(_swapModule), 'Swap module already supported');
  }

  function removeSwapProtocol(address _swapModule)
    external
    override
    nonReentrant
    onlyLendingManager
  {
    require(_swapModule != address(0), 'Swap module can not be 0x');
    require(swapModules.remove(_swapModule), 'Swap module not supported');
  }

  function setSwapModule(address _collateral, address _swapModule)
    external
    override
    nonReentrant
    onlyLendingManager
  {
    require(
      swapModules.contains(_swapModule) || _swapModule == address(0),
      'Swap module not supported'
    );
    collateralToSwapModule[_collateral] = _swapModule;
  }

  function setShares(
    address pool,
    uint64 daoInterestShare,
    uint64 jrtBuybackShare
  ) external override nonReentrant onlyLendingManager {
    PoolStorage storage poolData = poolStorage[pool];
    require(poolData.lendingModuleId != 0x00, 'Bad pool');
    require(
      jrtBuybackShare <= PreciseUnitMath.PRECISE_UNIT &&
        daoInterestShare <= PreciseUnitMath.PRECISE_UNIT,
      'Invalid share'
    );

    poolData.jrtBuybackShare = jrtBuybackShare;
    poolData.daoInterestShare = daoInterestShare;
  }

  function setPoolStorage(
    string memory lendingID,
    address pool,
    address collateral,
    address interestBearingToken,
    uint64 daoInterestShare,
    uint64 jrtBuybackShare
  ) external override nonReentrant onlyPoolFactory {
    bytes32 id = keccak256(abi.encode(lendingID));
    LendingInfo memory lendingInfo = idToLendingInfo[id];
    address lendingModule = lendingInfo.lendingModule;
    require(lendingModule != address(0), 'Module not supported');
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
    poolData.jrtBuybackShare = jrtBuybackShare;
    poolData.daoInterestShare = daoInterestShare;

    // set interest bearing token
    _setBearingToken(
      poolData,
      collateral,
      lendingModule,
      lendingInfo,
      interestBearingToken
    );
  }

  function migratePoolStorage(
    address oldPool,
    address newPool,
    uint256 newCollateralDeposited
  ) external override nonReentrant onlyLendingManager {
    PoolStorage memory oldPoolData = poolStorage[oldPool];
    bytes32 oldLendingId = oldPoolData.lendingModuleId;
    require(oldLendingId != 0x00, 'Bad migration pool');

    PoolStorage storage newPoolData = poolStorage[newPool];
    require(newPoolData.lendingModuleId == 0x00, 'Bad new pool');

    // copy storage to new pool
    newPoolData.lendingModuleId = oldLendingId;
    newPoolData.collateral = oldPoolData.collateral;
    newPoolData.interestBearingToken = oldPoolData.interestBearingToken;
    newPoolData.jrtBuybackShare = oldPoolData.jrtBuybackShare;
    newPoolData.daoInterestShare = oldPoolData.daoInterestShare;
    newPoolData.collateralDeposited = newCollateralDeposited;
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
    override
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
    _setBearingToken(
      poolData,
      poolData.collateral,
      newLendingModule,
      newLendingInfo,
      newInterestBearingToken
    );

    return (poolStorage[pool], newLendingInfo);
  }

  function updateValues(
    address pool,
    uint256 collateralDeposited,
    uint256 daoJRT,
    uint256 daoInterest
  ) external override nonReentrant onlyLendingManager {
    PoolStorage storage poolData = poolStorage[pool];
    require(poolData.lendingModuleId != 0x00, 'Bad pool');

    // update collateral deposit amount of the pool
    poolData.collateralDeposited = collateralDeposited;

    // update dao unclaimed interest of the pool
    poolData.unclaimedDaoJRT = daoJRT;
    poolData.unclaimedDaoCommission = daoInterest;
  }

  function getLendingModule(string memory _id)
    external
    view
    override
    returns (LendingInfo memory lendingInfo)
  {
    bytes32 lendingId = keccak256(abi.encode(_id));
    require(lendingId != 0x00, 'Wrong module identifier');
    lendingInfo = idToLendingInfo[lendingId];
    require(
      lendingInfo.lendingModule != address(0),
      'Lending module not supported'
    );
  }

  function getPoolData(address pool)
    external
    view
    override
    returns (PoolStorage memory poolData, LendingInfo memory lendingInfo)
  {
    poolData = poolStorage[pool];
    require(poolData.lendingModuleId != 0x00, 'Not existing pool');
    lendingInfo = idToLendingInfo[poolData.lendingModuleId];
  }

  function getPoolStorage(address pool)
    external
    view
    override
    returns (PoolStorage memory poolData)
  {
    poolData = poolStorage[pool];
    require(poolData.lendingModuleId != 0x00, 'Not existing pool');
  }

  function getLendingData(address pool)
    external
    view
    override
    returns (
      PoolLendingStorage memory lendingStorage,
      LendingInfo memory lendingInfo
    )
  {
    PoolStorage storage poolData = poolStorage[pool];
    require(poolData.lendingModuleId != 0x00, 'Not existing pool');
    lendingStorage.collateralToken = poolData.collateral;
    lendingStorage.interestToken = poolData.interestBearingToken;
    lendingInfo = idToLendingInfo[poolData.lendingModuleId];
  }

  function getSwapModules() external view override returns (address[] memory) {
    uint256 numberOfModules = swapModules.length();
    address[] memory modulesList = new address[](numberOfModules);
    for (uint256 j = 0; j < numberOfModules; j++) {
      modulesList[j] = swapModules.at(j);
    }
    return modulesList;
  }

  function getCollateralSwapModule(address collateral)
    external
    view
    override
    returns (address swapModule)
  {
    swapModule = collateralToSwapModule[collateral];
    require(
      swapModule != address(0),
      'Swap module not added for this collateral'
    );
    require(swapModules.contains(swapModule), 'Swap module not supported');
  }

  function getInterestBearingToken(address pool)
    external
    view
    override
    returns (address interestTokenAddr)
  {
    require(poolStorage[pool].lendingModuleId != 0x00, 'Not existing pool');
    interestTokenAddr = poolStorage[pool].interestBearingToken;
  }

  function getShares(address pool)
    external
    view
    override
    returns (uint256 jrtBuybackShare, uint256 daoInterestShare)
  {
    require(poolStorage[pool].lendingModuleId != 0x00, 'Not existing pool');
    jrtBuybackShare = poolStorage[pool].jrtBuybackShare;
    daoInterestShare = poolStorage[pool].daoInterestShare;
  }

  function getCollateralDeposited(address pool)
    external
    view
    override
    returns (uint256 collateralAmount)
  {
    require(poolStorage[pool].lendingModuleId != 0x00, 'Not existing pool');
    collateralAmount = poolStorage[pool].collateralDeposited;
  }

  function _setBearingToken(
    PoolStorage storage actualPoolData,
    address collateral,
    address lendingModule,
    LendingInfo memory lendingInfo,
    address interestToken
  ) internal {
    try
      ILendingModule(lendingModule).getInterestBearingToken(
        collateral,
        lendingInfo.args
      )
    returns (address interestTokenAddr) {
      actualPoolData.interestBearingToken = interestTokenAddr;
    } catch {
      require(interestToken != address(0), 'No bearing token passed');
      actualPoolData.interestBearingToken = interestToken;
    }
  }
}
