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

contract LendingProxy is ILendingProxy {
  using Address for address;
  using SafeERC20 for IERC20;

  address immutable finder;

  string public constant DEPOSIT_SIG =
    'deposit((address,address,address,address,address,uint256,uint256,uint256,uint256,uint256),uint256)';

  string public constant WITHDRAW_SIG =
    'withdraw((address,address,address,address,address,uint256,uint256,uint256,uint256,uint256),uint256,address)';

  string public JRTSWAP_SIG = 'swapToJRT(address,uint256,bytes)';

  mapping(address => PoolStorage) public poolStorage;

  modifier onlyPool() {
    require(poolStorage[msg.sender].lendingModule != address(0), 'Not allowed');
    _;
  }

  constructor(address _finder) {
    finder = _finder;
  }

  function deposit(uint256 amount)
    external
    override
    onlyPool
    returns (ReturnValues memory returnValues)
  {
    // retrieve caller pool data
    PoolStorage memory poolData = poolStorage[msg.sender];

    // delegate call implementation
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(DEPOSIT_SIG, poolData, amount)
      );

    returnValues = abi.decode(result, (ReturnValues));

    // update collateral deposit amount of the pool
    poolData.collateralDeposited += amount;

    // update dao unclaimed interest of the pool
    poolData.unclaimedDaoJRT +=
      returnValues.daoInterest *
      poolData.JRTBuybackShare;
    poolData.unclaimedDaoCommission +=
      returnValues.daoInterest *
      (1 - poolData.JRTBuybackShare);
  }

  function withdraw(uint256 amount, address recipient)
    external
    override
    onlyPool
    returns (ReturnValues memory returnValues)
  {
    // retrieve caller pool data
    PoolStorage memory poolData = poolStorage[msg.sender];

    // delegate call implementation
    bytes memory result =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(WITHDRAW_SIG, poolData, amount, recipient)
      );

    returnValues = abi.decode(result, (ReturnValues));

    // update poolLastDeposit
    poolData.collateralDeposited -= amount;

    // update unclaimed interest
    poolData.unclaimedDaoJRT +=
      returnValues.daoInterest *
      poolData.JRTBuybackShare;
    poolData.unclaimedDaoCommission +=
      returnValues.daoInterest *
      (1 - poolData.JRTBuybackShare);
  }

  function claimCommission()
    external
    override
    onlyPool
    returns (uint256 amountClaimed)
  {
    // withdraw unclaimedDaoCommission
    PoolStorage memory poolData = poolStorage[msg.sender];
    amountClaimed = poolData.unclaimedDaoCommission;
    poolData.unclaimedDaoCommission = 0;

    address recipient =
      ISynthereumFinder(finder).getImplementationAddress('CommissionReceiver');

    // delegate call withdraw
    address(poolData.lendingModule).functionDelegateCall(
      abi.encodeWithSignature(WITHDRAW_SIG, poolData, amountClaimed, recipient)
    );
  }

  function executeBuyback(bytes memory swapParams)
    external
    override
    onlyPool
    returns (uint256 amountOut)
  {
    // withdraw unclaimedDaoJRT and swap it to JRT
    PoolStorage memory poolData = poolStorage[msg.sender];
    uint256 unclaimed = poolData.unclaimedDaoJRT;
    poolData.unclaimedDaoJRT = 0;

    // delegate call withdraw into collateral
    bytes memory withdrawRes =
      address(poolData.lendingModule).functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          poolData,
          unclaimed,
          address(this)
        )
      );
    uint256 tokensOut = abi.decode(withdrawRes, (ReturnValues)).tokensOut;

    // delegate call the swap to JRT
    address recipient =
      ISynthereumFinder(finder).getImplementationAddress(
        'BuybackProgramReceiver'
      );

    bytes memory result =
      address(poolData.jrtSwapModule).functionDelegateCall(
        abi.encodeWithSignature(JRTSWAP_SIG, recipient, tokensOut, swapParams)
      );

    amountOut = abi.decode(result, (uint256));
  }
}
