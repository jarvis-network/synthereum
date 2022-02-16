// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

import {ILendingProxy} from './interfaces/ILendingProxy.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {
  ISynthereumDeployment
} from '@jarvis-network/synthereum-contracts/contracts/common/interfaces/IDeployment.sol';
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

  mapping(string => address) public idToLending;
  mapping(address => bytes) lendingToArgs;
  mapping(address => address) public collateralToSwapModule;

  // pool storage in separate registry
  mapping(address => PoolStorage) public poolStorage;

  address immutable finder;
  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  string public constant DEPOSIT_SIG =
    'deposit((address,address,address,address,address,uint256,uint256,uint256,uint256,uint256),uint256)';

  string public constant WITHDRAW_SIG =
    'withdraw((address,address,address,address,address,uint256,uint256,uint256,uint256,uint256),uint256,address)';

  string public JRTSWAP_SIG = 'swapToJRT(address,uint256,bytes)';

  modifier onlyPool() {
    require(poolStorage[msg.sender].lendingModule != address(0), 'Not allowed');
    _;
  }

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  constructor(address _finder) {
    finder = _finder;

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
  }

  function deposit(uint256 amount)
    external
    override
    onlyPool
    returns (ReturnValues memory returnValues)
  {
    // retrieve caller pool data
    PoolStorage storage poolData = poolStorage[msg.sender];

    // delegate call implementation
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(DEPOSIT_SIG, poolData, amount)
      );

    returnValues = abi.decode(result, (ReturnValues));

    // update collateral deposit amount of the pool
    poolData.collateralDeposited += amount + returnValues.poolInterest;

    // update dao unclaimed interest of the pool
    poolData.unclaimedDaoJRT +=
      returnValues.daoInterest *
      poolData.JRTBuybackShare;
    poolData.unclaimedDaoCommission +=
      returnValues.daoInterest *
      (1 - poolData.JRTBuybackShare);

    emit Deposit(msg.sender, amount);
  }

  function withdraw(uint256 amount, address recipient)
    external
    override
    onlyPool
    returns (ReturnValues memory returnValues)
  {
    // retrieve caller pool data
    PoolStorage storage poolData = poolStorage[msg.sender];

    // delegate call implementation
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(WITHDRAW_SIG, poolData, amount, recipient)
      );

    returnValues = abi.decode(result, (ReturnValues));

    // setValues()
    // update poolLastDeposit
    poolData.collateralDeposited =
      poolData.collateralDeposited +
      returnValues.poolInterest -
      amount;

    // update unclaimed interest
    poolData.unclaimedDaoJRT +=
      returnValues.daoInterest *
      poolData.JRTBuybackShare;
    poolData.unclaimedDaoCommission +=
      returnValues.daoInterest *
      (1 - poolData.JRTBuybackShare);

    emit Withdraw(msg.sender, amount, recipient);
  }

  // add amount
  function claimCommission(uint256 amount)
    external
    override
    onlyPool
    returns (uint256)
  {
    // withdraw unclaimedDaoCommission
    PoolStorage storage poolData = poolStorage[msg.sender];

    address recipient =
      ISynthereumFinder(finder).getImplementationAddress('CommissionReceiver');

    // delegate call withdraw
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(WITHDRAW_SIG, poolData, amount, recipient)
      );

    ReturnValues memory returnValues = abi.decode(result, (ReturnValues));

    //update pool deposit with interest
    poolData.collateralDeposited += returnValues.poolInterest;

    // update unclaimedDao interest - if amount is more than what due to the dao it will revert
    poolData.unclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
      returnValues.daoInterest -
      amount;

    return amount;
  }

  // add amount
  function executeBuyback(uint256 amount, bytes memory swapParams)
    external
    override
    onlyPool
    returns (uint256 amountOut)
  {
    // withdraw unclaimedDaoJRT and swap it to JRT
    PoolStorage storage poolData = poolStorage[msg.sender];

    // delegate call withdraw into collateral
    bytes memory withdrawRes =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(WITHDRAW_SIG, poolData, amount, address(this))
      );
    ReturnValues memory returnValues = abi.decode(withdrawRes, (ReturnValues));

    //update pool deposit with interest
    poolData.collateralDeposited += returnValues.poolInterest;

    // update unclaimedDao interest - if amount is more than what due to the dao it will revert
    poolData.unclaimedDaoCommission =
      poolData.unclaimedDaoCommission +
      returnValues.daoInterest -
      amount;

    // delegate call the swap to JRT
    address recipient =
      ISynthereumFinder(finder).getImplementationAddress(
        'BuybackProgramReceiver'
      );

    bytes memory result =
      address(collateralToSwapModule[poolData.collateral]).functionDelegateCall(
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
    address lendingModule = idToLending[lendingID];
    PoolStorage storage poolData = poolStorage[pool];
    poolData.collateral = collateral;
    poolData.daoInterestShare = daoInterestShare;
    poolData.JRTBuybackShare = jrtBuybackShare;
    //TODO retrieve interest baring token
    // poolData.interestBearingToken = interestBearingToken == address(0) ? ILendingProxy(lendingModule) : interestBearingToken;
  }

  // when pool is upgraded
  // function migrateLiquidity(address newPool) external onlyPool {
  //   // set msg.sender storage as newPool storage
  //   // delete msg.sender storage
  // }

  // // move from AAVE to compound
  // function migrateLendingModule(address newLendingModule) external onlyPool {
  //     // delegate call withdraw pool - old module - recipient proxy
  //     // reset pool data (interest to 0)
  //     // deposit call on new module - new interest = 0
  //     // reset interest to old
  // }
}
