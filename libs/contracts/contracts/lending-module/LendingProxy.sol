// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ILendingProxy} from './interfaces/ILendingProxy.sol';
import {ILendingModule} from './interfaces/ILendingModule.sol';
import {ILendingStorageManager} from './interfaces/ILendingStorageManager.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

contract LendingProxy is ILendingProxy, AccessControlEnumerable {
  using Address for address;
  using SafeERC20 for IERC20;

  address immutable finder;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  string private constant DEPOSIT_SIG =
    'deposit((address,address,address,uint256,uint256,uint256,uint256,uint256),address,uint256)';

  string private constant WITHDRAW_SIG =
    'withdraw((address,address,address,uint256,uint256,uint256,uint256,uint256),address,uint256,address)';

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
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call implementation
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          DEPOSIT_SIG,
          poolData,
          poolStorageManager,
          amount
        )
      );

    returnValues = abi.decode(result, (ReturnValues));

    // update pool storage values
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + amount + returnValues.poolInterest;
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        (returnValues.daoInterest * poolData.JRTBuybackShare) /
        10**18;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        (returnValues.daoInterest * (10**18 - poolData.JRTBuybackShare)) /
        10**18;

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );
  }

  function withdraw(uint256 amount, address recipient)
    external
    override
    returns (ReturnValues memory returnValues)
  {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call implementation
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          poolStorageManager,
          amount,
          recipient
        )
      );

    returnValues = abi.decode(result, (ReturnValues));

    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest - amount;
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        (returnValues.daoInterest * poolData.JRTBuybackShare) /
        10**18;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        (returnValues.daoInterest * (10**18 - poolData.JRTBuybackShare)) /
        10**18;

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );
  }

  // batch
  function claimCommission(uint256 amount)
    external
    override
    returns (ReturnValues memory returnValues)
  {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    address recipient =
      ISynthereumFinder(finder).getImplementationAddress('CommissionReceiver');

    // delegate call withdraw
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          poolStorageManager,
          amount,
          recipient
        )
      );
    returnValues = abi.decode(result, (ReturnValues));

    //update pool storage
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission -
        amount +
        (returnValues.daoInterest * (10**18 - poolData.JRTBuybackShare)) /
        10**18;
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        (returnValues.daoInterest * poolData.JRTBuybackShare) /
        10**18;

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );
  }

  // add amount
  function executeBuyback(uint256 amount, bytes memory swapParams)
    external
    override
    returns (ReturnValues memory returnValues)
  {
    (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call withdraw into collateral
    bytes memory withdrawRes =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          poolStorageManager,
          amount,
          address(this)
        )
      );
    returnValues = abi.decode(withdrawRes, (ReturnValues));

    //update pool storage
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        (returnValues.daoInterest * (10**18 - poolData.JRTBuybackShare)) /
        10**18;
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT -
        amount +
        (returnValues.daoInterest * poolData.JRTBuybackShare) /
        10**18;

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

  // called by factory
  function setLendingModule(
    address lendingModule,
    bytes memory args,
    string memory id
  ) external onlyMaintainer {
    ILendingStorageManager poolStorageManager = getStorageManager();
    poolStorageManager.setLendingModule(lendingModule, args, id);
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
      ILendingStorageManager poolStorageManager
    ) = onlyPool();

    // delegate call withdraw collateral from old module
    bytes memory withdrawRes =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          poolStorageManager,
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
        (returnValues.daoInterest * poolData.JRTBuybackShare) /
        10**18;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        (returnValues.daoInterest * (10**18 - poolData.JRTBuybackShare)) /
        10**18;

    // temporary set pool storage collateral to 0 to freshly deposit
    poolStorageManager.updateValues(msg.sender, 0, 0, 0);

    // set new lending module and obtain new pool data
    poolData = poolStorageManager.migrateLendingModule(
      msg.sender,
      newLendingID,
      newInterestBearingToken
    );

    // delegate call deposit into new module
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          DEPOSIT_SIG,
          poolData,
          poolStorageManager,
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
    ILendingStorageManager.PoolStorage memory poolData =
      poolStorageManager.getPoolStorage(pool);

    bytes memory extraArgs =
      poolStorageManager.getLendingArgs(poolData.lendingModule);

    interestTokenAmount = ILendingModule(poolData.lendingModule)
      .collateralToInterestToken(
      collateralAmount,
      poolData.collateral,
      poolData.interestBearingToken,
      extraArgs,
      isExactTransfer
    );
    interestTokenAddr = poolData.interestBearingToken;
  }

  function getInterestBearingToken(address pool)
    external
    view
    returns (address interestTokenAddr)
  {
    ILendingStorageManager poolStorageManager = getStorageManager();
    interestTokenAddr = poolStorageManager
      .getPoolStorage(pool)
      .interestBearingToken;
  }

  function getAccumulatedInterest(address pool)
    external
    view
    returns (uint256 poolInterest)
  {
    ILendingStorageManager poolStorageManager = getStorageManager();
    ILendingStorageManager.PoolStorage memory poolData =
      poolStorageManager.getPoolStorage(pool);

    (poolInterest, ) = ILendingModule(poolData.lendingModule)
      .getAccumulatedInterest(pool, poolData);
  }

  function onlyPool()
    internal
    view
    returns (
      ILendingStorageManager.PoolStorage memory poolData,
      ILendingStorageManager poolStorageManager
    )
  {
    poolStorageManager = getStorageManager();
    poolData = poolStorageManager.getPoolStorage(msg.sender);
    require(poolData.lendingModule != address(0), 'Not allowed');
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
