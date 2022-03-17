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
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import 'hardhat/console.sol';

contract LendingManager is
  ILendingManager,
  AccessControlEnumerable,
  ReentrancyGuard
{
  using Address for address;
  using SafeERC20 for IERC20;
  using PreciseUnitMath for uint256;

  address immutable finder;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  string private constant DEPOSIT_SIG =
    'deposit((bytes32,address,address,uint256,uint256,uint256,uint256,uint256),bytes,uint256,address)';

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

  constructor(address _finder, Roles memory _roles) nonReentrant {
    finder = _finder;

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  function deposit(uint256 amount, address recipient)
    external
    override
    nonReentrant
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
          DEPOSIT_SIG,
          poolData,
          lendingInfo.args,
          amount,
          recipient
        )
      );

    ILendingModule.ReturnValues memory res =
      abi.decode(result, (ILendingModule.ReturnValues));

    // split interest
    InterestSplit memory interestSplit =
      splitGeneratedInterest(
        res.totalInterest,
        poolData.daoInterestShare,
        poolData.JRTBuybackShare
      );

    // update pool storage values
    poolStorageManager.updateValues(
      msg.sender,
      poolData.collateralDeposited + res.tokensOut + interestSplit.poolInterest,
      poolData.unclaimedDaoJRT + interestSplit.jrtInterest,
      poolData.unclaimedDaoCommission + interestSplit.commissionInterest
    );

    // set return values
    returnValues.tokensOut = res.tokensOut;
    returnValues.tokensTransferred = res.tokensTransferred;
    returnValues.poolInterest = interestSplit.poolInterest;
    returnValues.daoInterest =
      interestSplit.commissionInterest +
      interestSplit.jrtInterest;
  }

  function withdraw(uint256 interestTokenAmount, address recipient)
    external
    override
    nonReentrant
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

    ILendingModule.ReturnValues memory res =
      abi.decode(result, (ILendingModule.ReturnValues));

    // split interest
    InterestSplit memory interestSplit =
      splitGeneratedInterest(
        res.totalInterest,
        poolData.daoInterestShare,
        poolData.JRTBuybackShare
      );

    // update storage value
    poolStorageManager.updateValues(
      msg.sender,
      poolData.collateralDeposited + interestSplit.poolInterest - res.tokensOut,
      poolData.unclaimedDaoJRT + interestSplit.jrtInterest,
      poolData.unclaimedDaoCommission + interestSplit.commissionInterest
    );

    // set return values
    returnValues.tokensOut = res.tokensOut;
    returnValues.tokensTransferred = res.tokensTransferred;
    returnValues.poolInterest = interestSplit.poolInterest;
    returnValues.daoInterest =
      interestSplit.commissionInterest +
      interestSplit.jrtInterest;
  }

  function batchClaimCommission(
    address[] memory pools,
    uint256[] memory amounts
  ) external override onlyMaintainer nonReentrant {
    require(pools.length == amounts.length, 'Invalid call');
    address recipient =
      ISynthereumFinder(finder).getImplementationAddress('CommissionReceiver');
    for (uint8 i = 0; i < pools.length; i++) {
      claimCommission(pools[i], amounts[i], recipient);
    }

    // todo emit event
  }

  // add amount
  function executeBuyback(uint256 collateralAmount, bytes memory swapParams)
    external
    override
    nonReentrant
    returns (ReturnValues memory returnValues)
  {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call withdraw into collateral
    bytes memory withdrawRes;
    {
      (uint256 interestTokenAmount, ) =
        ILendingManager(address(this)).collateralToInterestToken(
          msg.sender,
          collateralAmount,
          true
        );

      // trigger transfer of interest token from the pool
      ISynthereumMultiLpLiquidityPool(msg.sender).transferToLendingManager(
        interestTokenAmount
      );

      withdrawRes = address(lendingInfo.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          msg.sender,
          lendingInfo.args,
          interestTokenAmount,
          address(this)
        )
      );
    }
    ILendingModule.ReturnValues memory res =
      abi.decode(withdrawRes, (ILendingModule.ReturnValues));

    // split interest
    InterestSplit memory interestSplit =
      splitGeneratedInterest(
        res.totalInterest,
        poolData.daoInterestShare,
        poolData.JRTBuybackShare
      );

    //update pool storage
    poolStorageManager.updateValues(
      msg.sender,
      poolData.collateralDeposited + interestSplit.poolInterest,
      poolData.unclaimedDaoJRT - collateralAmount + interestSplit.jrtInterest,
      poolData.unclaimedDaoCommission + interestSplit.commissionInterest
    );

    // delegate call the swap to JRT
    bytes memory result =
      address(poolStorageManager.getCollateralSwapModule(poolData.collateral))
        .functionDelegateCall(
        abi.encodeWithSignature(
          JRTSWAP_SIG,
          ISynthereumFinder(finder).getImplementationAddress(
            'BuybackProgramReceiver'
          ),
          res.tokensOut,
          swapParams
        )
      );

    // set return values
    returnValues.tokensTransferred = res.tokensTransferred;
    returnValues.tokensOut = abi.decode(result, (uint256));
    returnValues.poolInterest = interestSplit.poolInterest;
    returnValues.daoInterest =
      interestSplit.jrtInterest +
      interestSplit.commissionInterest;
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

  // to migrate liquidity to another lending module
  function migrateLendingModule(
    string memory newLendingID,
    address newInterestBearingToken,
    uint256 interestTokenAmount
  ) external nonReentrant returns (ReturnValues memory returnValues) {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager.LendingInfo memory lendingInfo,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call withdraw collateral from old module
    ILendingModule.ReturnValues memory res;
    {
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

      res = abi.decode(withdrawRes, (ILendingModule.ReturnValues));
    }
    // split interest
    InterestSplit memory interestSplit =
      splitGeneratedInterest(
        res.totalInterest,
        poolData.daoInterestShare,
        poolData.JRTBuybackShare
      );

    // add interest to pool data
    uint256 newDaoJRT = poolData.unclaimedDaoJRT + interestSplit.jrtInterest;
    uint256 newDaoCommission =
      poolData.unclaimedDaoCommission + interestSplit.commissionInterest;

    // temporary set pool data collateral and interest to 0 to freshly deposit
    poolStorageManager.updateValues(msg.sender, 0, 0, 0);

    // set new lending module and obtain new pool data
    ILendingStorageManager.LendingInfo memory newLendingInfo;
    (poolData, newLendingInfo) = poolStorageManager.migrateLendingModule(
      newLendingID,
      msg.sender,
      newInterestBearingToken
    );

    // delegate call deposit into new module
    bytes memory result =
      address(newLendingInfo.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          DEPOSIT_SIG,
          poolData,
          newLendingInfo.args,
          res.tokensOut,
          msg.sender
        )
      );

    ILendingModule.ReturnValues memory depositRes =
      abi.decode(result, (ILendingModule.ReturnValues));

    // update storage with accumulated interest
    poolStorageManager.updateValues(
      msg.sender,
      depositRes.tokensOut + interestSplit.poolInterest,
      newDaoJRT,
      newDaoCommission
    );

    // set the return values tokensOut
    returnValues.tokensOut = depositRes.tokensOut;
    returnValues.tokensTransferred = depositRes.tokensTransferred;
    returnValues.poolInterest = interestSplit.poolInterest;
    returnValues.daoInterest =
      interestSplit.commissionInterest +
      interestSplit.jrtInterest;
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

    uint256 totalInterest =
      ILendingModule(lendingInfo.lendingModule).getAccumulatedInterest(
        pool,
        poolData,
        lendingInfo.args
      );

    InterestSplit memory interestSplit =
      splitGeneratedInterest(
        totalInterest,
        poolData.daoInterestShare,
        poolData.JRTBuybackShare
      );
    poolInterest = interestSplit.poolInterest;
    collateralDeposited = poolData.collateralDeposited;
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
    ILendingModule.ReturnValues memory res =
      abi.decode(result, (ILendingModule.ReturnValues));

    // split interest
    InterestSplit memory interestSplit =
      splitGeneratedInterest(
        res.totalInterest,
        poolData.daoInterestShare,
        poolData.JRTBuybackShare
      );

    //update pool storage
    poolStorageManager.updateValues(
      pool,
      poolData.collateralDeposited + interestSplit.poolInterest,
      poolData.unclaimedDaoJRT + interestSplit.jrtInterest,
      poolData.unclaimedDaoCommission -
        collateralAmount +
        interestSplit.commissionInterest
    );
  }

  function splitGeneratedInterest(
    uint256 totalInterestGenerated,
    uint256 daoRatio,
    uint256 jrtRatio
  ) internal pure returns (InterestSplit memory interestSplit) {
    if (totalInterestGenerated == 0) return interestSplit;

    uint256 daoInterest = totalInterestGenerated.mul(daoRatio);
    interestSplit.jrtInterest = daoInterest.mul(jrtRatio);
    interestSplit.commissionInterest = daoInterest - interestSplit.jrtInterest;
    interestSplit.poolInterest = totalInterestGenerated - daoInterest;
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
