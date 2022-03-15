// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ILendingManager} from './interfaces/ILendingManager.sol';
import {ILendingModule} from './interfaces/ILendingModule.sol';
import {ILendingStorageManager} from './interfaces/ILendingStorageManager.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPool.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

contract LendingManager is ILendingManager, AccessControlEnumerable {
  using Address for address;
  using SafeERC20 for IERC20;
  using PreciseUnitMath for uint256;

  address immutable finder;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  string private constant DEPOSIT_SIG =
    'deposit((bytes32,address,address,uint256,uint256,uint256,uint256,uint256),bytes,uint256)';

  string private constant WITHDRAW_SIG =
    'withdraw((bytes32,address,address,uint256,uint256,uint256,uint256,uint256),address,bytes,uint256,address)';

  string private JRTSWAP_SIG = 'swapToJRT(address,uint256,bytes)';

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  constructor(address _finder, Roles memory _roles) {
    finder = _finder;

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  function deposit(uint256 amount)
    external
    override
    returns (ReturnValues memory returnValues)
  {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call implementation
    bytes memory result =
      address(lendingInfo.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(DEPOSIT_SIG, poolData, lendingInfo.args, amount)
      );

    returnValues = abi.decode(result, (ReturnValues));

    // update pool storage values
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + amount + returnValues.poolInterest;
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        returnValues.daoInterest.mul(poolData.JRTBuybackShare);
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        returnValues.daoInterest.mul(
          PreciseUnitMath.PRECISE_UNIT - poolData.JRTBuybackShare
        );

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );
  }

  function withdraw(uint256 interestTokenAmount, address recipient)
    external
    override
    returns (ReturnValues memory returnValues)
  {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call implementation
    bytes memory result =
      address(lendingInfo.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          msg.sender,
          lendingInfo.args,
          interestTokenAmount,
          recipient
        )
      );

    returnValues = abi.decode(result, (ReturnValues));

    uint256 newCollateralDeposited =
      poolData.collateralDeposited +
        returnValues.poolInterest -
        interestTokenAmount;
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        returnValues.daoInterest.mul(poolData.JRTBuybackShare);
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        returnValues.daoInterest.mul(
          PreciseUnitMath.PRECISE_UNIT - poolData.JRTBuybackShare
        );

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );
  }

  function batchClaimCommission(
    address[] memory pools,
    uint256[] memory amounts
  ) external override onlyMaintainer {
    require(pools.length == amounts.length, 'Invalid call');
    address recipient =
      ISynthereumFinder(finder).getImplementationAddress('CommissionReceiver');
    for (uint8 i = 0; i < pools.length; i++) {
      claimCommission(pools[i], amounts[i], recipient);
    }

    // todo emit event
  }

  function claimCommission(
    address pool,
    uint256 collateralAmount,
    address recipient
  ) internal {
    ILendingStorageManager poolStorageManager = getStorageManager();
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo
    ) = poolStorageManager.getPoolStorage(pool);

    // trigger transfer of funds from pool
    (uint256 interestTokenAmount, ) =
      ILendingManager(address(this)).collateralToInterestToken(
        pool,
        collateralAmount,
        true
      );
    ISynthereumMultiLpLiquidityPool(pool).transferToLendingManager(
      interestTokenAmount
    );

    // delegate call withdraw
    bytes memory result =
      address(lendingInfo.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          pool,
          lendingInfo.args,
          interestTokenAmount,
          recipient
        )
      );
    ReturnValues memory returnValues = abi.decode(result, (ReturnValues));

    //update pool storage
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest;

    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission -
        collateralAmount +
        returnValues.daoInterest.mul(
          PreciseUnitMath.PRECISE_UNIT - poolData.JRTBuybackShare
        );

    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        returnValues.daoInterest.mul(poolData.JRTBuybackShare);

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );
  }

  // add amount
  function executeBuyback(uint256 collateralAmount, bytes memory swapParams)
    external
    override
    returns (ReturnValues memory returnValues)
  {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call withdraw into collateral
    (uint256 interestTokenAmount, ) =
      ILendingManager(address(this)).collateralToInterestToken(
        msg.sender,
        collateralAmount,
        true
      );
    bytes memory withdrawRes =
      address(lendingInfo.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          msg.sender,
          lendingInfo.args,
          interestTokenAmount,
          address(this)
        )
      );
    returnValues = abi.decode(withdrawRes, (ReturnValues));

    //update pool storage
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest;

    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        returnValues.daoInterest.mul(
          PreciseUnitMath.PRECISE_UNIT - poolData.JRTBuybackShare
        );

    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT -
        collateralAmount +
        returnValues.daoInterest.mul(poolData.JRTBuybackShare);

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );

    // delegate call the swap to JRT
    address recipient =
      ISynthereumFinder(finder).getImplementationAddress(
        'BuybackProgramReceiver'
      );

    // retrieve address
    bytes memory result =
      address(poolStorageManager.getCollateralSwapModule(poolData.collateral))
        .functionDelegateCall(
        abi.encodeWithSignature(
          JRTSWAP_SIG,
          recipient,
          returnValues.tokensOut,
          swapParams
        )
      );

    returnValues.tokensOut = abi.decode(result, (uint256));
  }

  function setSwapModule(address swapModule, address collateral)
    external
    onlyMaintainer
  {
    ILendingStorageManager poolStorageManager = getStorageManager();
    poolStorageManager.setSwapModule(swapModule, collateral);
  }

  function setShares(
    address pool,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external onlyMaintainer {
    ILendingStorageManager poolStorageManager = getStorageManager();
    poolStorageManager.setShares(pool, daoInterestShare, jrtBuybackShare);
  }

  // when pool is upgraded and liquidity transfered to a new Pool
  function migrateLiquidity(address newPool) external {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // migrate through storage manager
    poolStorageManager.migratePool(msg.sender, newPool);
  }

  // to migrate liquidity to another lending module
  function migrateLendingModule(
    string memory newLendingID,
    address newInterestBearingToken,
    uint256 interestTokenAmount
  ) external returns (ReturnValues memory returnValues) {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call withdraw collateral from old module
    bytes memory withdrawRes =
      address(lendingInfo.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          msg.sender,
          lendingInfo.args,
          interestTokenAmount,
          address(this)
        )
      );
    returnValues = abi.decode(withdrawRes, (ReturnValues));
    // update storage with accumulated interest
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest;

    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        returnValues.daoInterest.mul(poolData.JRTBuybackShare);

    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        returnValues.daoInterest.mul(
          PreciseUnitMath.PRECISE_UNIT - poolData.JRTBuybackShare
        );

    // temporary set pool storage collateral to 0 to freshly deposit
    poolStorageManager.updateValues(msg.sender, 0, 0, 0);

    // set new lending module and obtain new pool data
    ILendingStorageManager.LendingInfo memory newLendingInfo;
    (poolData, newLendingInfo) = poolStorageManager.migrateLendingModule(
      msg.sender,
      newLendingID,
      newInterestBearingToken
    );

    // delegate call deposit into new module
    bytes memory result =
      address(newLendingInfo.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          DEPOSIT_SIG,
          poolData,
          newLendingInfo.args,
          returnValues.tokensOut
        )
      );

    // set pool storage
    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );

    // set the return values tokensOut
    returnValues.tokensOut = abi.decode(result, (ReturnValues)).tokensOut;
  }

  function collateralToInterestToken(
    address pool,
    uint256 collateralAmount,
    bool isExactTransfer
  )
    external
    view
    returns (uint256 interestTokenAmount, address interestTokenAddr)
  {
    ILendingStorageManager poolStorageManager = getStorageManager();
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo
    ) = poolStorageManager.getPoolStorage(pool);

    interestTokenAmount = ILendingModule(lendingInfo.lendingModule)
      .collateralToInterestToken(
      collateralAmount,
      poolData.collateral,
      poolData.interestBearingToken,
      lendingInfo.args,
      isExactTransfer
    );
    interestTokenAddr = poolData.interestBearingToken;
  }

  function getAccumulatedInterest(address pool)
    external
    view
    returns (uint256 poolInterest, uint256 collateralDeposited)
  {
    ILendingStorageManager poolStorageManager = getStorageManager();
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo
    ) = poolStorageManager.getPoolStorage(pool);

    (poolInterest, ) = ILendingModule(lendingInfo.lendingModule)
      .getAccumulatedInterest(pool, poolData);

    collateralDeposited = poolData.collateralDeposited;
  }

  function onlyPool()
    internal
    view
    returns (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo,
      ILendingStorageManager poolStorageManager
    )
  {
    poolStorageManager = getStorageManager();
    (poolData, lendingInfo) = poolStorageManager.getPoolStorage(msg.sender);
    require(lendingInfo.lendingModule != address(0), 'Not allowed');
  }

  function getStorageManager() internal view returns (ILendingStorageManager) {
    return
      ILendingStorageManager(
        ISynthereumFinder(finder).getImplementationAddress(
          SynthereumInterfaces.LendingStorageManager
        )
      );
  }
}
