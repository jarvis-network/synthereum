// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ILendingProxy} from './interfaces/ILendingProxy.sol';
import {IPoolStorageManager} from './interfaces/IPoolStorageManager.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
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
  IPoolStorageManager immutable poolStorageManager;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  string public constant DEPOSIT_SIG =
    'deposit((address,address,address,address,address,uint256,uint256,uint256,uint256,uint256),address,uint256)';

  string public constant WITHDRAW_SIG =
    'withdraw((address,address,address,address,address,uint256,uint256,uint256,uint256,uint256),address,uint256,address)';

  string public JRTSWAP_SIG = 'swapToJRT(address,uint256,bytes)';

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  constructor(address _finder, address _poolStorage) {
    finder = _finder;
    poolStorageManager = IPoolStorageManager(_poolStorage);

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
  }

  function deposit(uint256 amount)
    external
    override
    returns (ReturnValues memory returnValues)
  {
    // retrieve caller pool data
    IPoolStorageManager.PoolStorage memory poolData =
      poolStorageManager.getPoolStorage(msg.sender);
    require(poolData.lendingModule != address(0), 'Not allowed');

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
        returnValues.daoInterest *
        poolData.JRTBuybackShare;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        returnValues.daoInterest *
        (1 - poolData.JRTBuybackShare);

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );

    emit Deposit(msg.sender, amount);
  }

  function withdraw(uint256 amount, address recipient)
    external
    override
    returns (ReturnValues memory returnValues)
  {
    // retrieve caller pool data
    IPoolStorageManager.PoolStorage memory poolData =
      poolStorageManager.getPoolStorage(msg.sender);
    require(poolData.lendingModule != address(0), 'Not allowed');

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

    // update pool storage values
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest - amount;
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        returnValues.daoInterest *
        poolData.JRTBuybackShare;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        returnValues.daoInterest *
        (1 - poolData.JRTBuybackShare);

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );

    emit Withdraw(msg.sender, amount, recipient);
  }

  function claimCommission(uint256 amount) external override returns (uint256) {
    // retrieve caller pool data
    IPoolStorageManager.PoolStorage memory poolData =
      poolStorageManager.getPoolStorage(msg.sender);
    require(poolData.lendingModule != address(0), 'Not allowed');

    address recipient =
      ISynthereumFinder(finder).getImplementationAddress('CommissionReceiver');

    // delegate call withdraw
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(WITHDRAW_SIG, poolData, amount, recipient)
      );

    ReturnValues memory returnValues = abi.decode(result, (ReturnValues));

    //update pool storage
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        returnValues.daoInterest *
        (1 - poolData.JRTBuybackShare) -
        amount;
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        returnValues.daoInterest *
        poolData.JRTBuybackShare;

    poolStorageManager.updateValues(
      msg.sender,
      newCollateralDeposited,
      newUnclaimedDaoJRT,
      newUnclaimedDaoCommission
    );

    return amount;
  }

  // add amount
  function executeBuyback(uint256 amount, bytes memory swapParams)
    external
    override
    returns (uint256 amountOut)
  {
    // retrieve caller pool data
    IPoolStorageManager.PoolStorage memory poolData =
      poolStorageManager.getPoolStorage(msg.sender);
    require(poolData.lendingModule != address(0), 'Not allowed');

    // delegate call withdraw into collateral
    bytes memory withdrawRes =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(WITHDRAW_SIG, poolData, amount, address(this))
      );
    ReturnValues memory returnValues = abi.decode(withdrawRes, (ReturnValues));

    //update pool storage
    uint256 newCollateralDeposited =
      poolData.collateralDeposited + returnValues.poolInterest;
    uint256 newUnclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
        returnValues.daoInterest *
        (1 - poolData.JRTBuybackShare);
    uint256 newUnclaimedDaoJRT =
      poolData.unclaimedDaoJRT +
        returnValues.daoInterest *
        poolData.JRTBuybackShare -
        amount;

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

    amountOut = abi.decode(result, (uint256));
  }

  // clled by factory
  function setPool(
    address pool,
    address collateral,
    string memory lendingID,
    address interestBearingToken,
    uint256 daoInterestShare,
    uint256 jrtBuybackShare
  ) external override onlyMaintainer {
    poolStorageManager.setPoolStorage(
      pool,
      collateral,
      lendingID,
      interestBearingToken,
      daoInterestShare,
      jrtBuybackShare
    );
  }

  // when pool is upgraded and liquidity transfered to a new Pool
  function migrateLiquidity(address newPool) external {
    // only a registered pool is allowed
    IPoolStorageManager.PoolStorage memory poolData =
      poolStorageManager.getPoolStorage(msg.sender);
    require(poolData.lendingModule != address(0), 'Not allowed');

    // migrate through storage manager
    poolStorageManager.migratePool(msg.sender, newPool);
  }

  function migrateLendingModule(
    address newLendingModule,
    address newInterestBearingToken
  ) external onlyPool {
    // only a registered pool is allowed
    IPoolStorageManager.PoolStorage memory poolData =
      poolStorageManager.getPoolStorage(msg.sender);
    require(poolData.lendingModule != address(0), 'Not allowed');

    // delegate call withdraw collateral from old module
    uint256 totalAmount =
      poolData.collateralDeposited +
        poolData.unclaimedDaoJRT +
        poolData.unclaimedDaoCommission;
    bytes memory withdrawRes =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          totalAmount,
          address(this)
        )
      );
    ReturnValues memory returnValues = abi.decode(withdrawRes, (ReturnValues));

    // update storage
    newPoolData = poolStorageManager.migrateLendingModule(
      msg.sender,
      newLendingModule,
      newInterestBearingToken
    );
    // get updated info
    IPoolStorageManager.PoolStorage memory newPoolData =
      poolStorageManager.getPoolStorage(msg.sender);

    // delegate call deposit into new module
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          DEPOSIT_SIG,
          newPoolData,
          poolStorageManager,
          totalAmount
        )
      );

    returnValues = abi.decode(result, (ReturnValues));
  }
}
