// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

import {ILendingProxy} from './interfaces/ILendingProxy.sol';
import {IPool} from '@aave/core-v3/contracts/interfaces/IPool.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {
  ISynthereumDeployment
} from '@jarvis-network/synthereum-contracts/contracts/common/interfaces/IDeployment.sol';
import {
  IUniswapV2Router02
} from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract LendingProxy is ILendingProxy {
  using Address for address;
  using SafeERC20 for IERC20;

  address public maintainer;
  address immutable finder;

  string public constant DEPOSIT_SIG =
    'deposit((address,address,address,address,uint256,uint256,uint256,uint256,uint256),uint256)';

  string public constant WITHDRAW_SIG =
    'withdraw((address,address,address,address,uint256,uint256,uint256,uint256,uint256),uint256,address)';

  mapping(address => PoolStorage) public poolStorage;

  modifier onlyPool() {
    require(poolStorage[msg.sender].lendingModule != address(0), 'Not allowed');
    _;
  }

  modifier onlyMaintainer() {
    require(msg.sender == maintainer, 'Only maintainter');
    _;
  }

  constructor(address _maintainer, address _finder) {
    maintainer = _maintainer;
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
        abi.encodeWithSignature(WITHDRAW_SIG, poolData, amount)
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

  function claimCommission(address pool)
    external
    override
    onlyMaintainer
    returns (uint256 amountClaimed)
  {
    // withdraw % of commission from unclaimed interest
    PoolStorage memory poolData = poolStorage[pool];
    amountClaimed = poolData.unclaimedDaoCommission;
    poolData.unclaimedDaoCommission = 0;

    IERC20 collateral = ISynthereumDeployment(pool).collateralToken();
    // pull tokens from pool
    // pool.transfer
    collateral.safeTransferFrom(pool, address(this), amountClaimed);
    collateral.safeIncreaseAllowance(poolData.moneyMarket, amountClaimed);
    // redeem them on aave and forward to commission receiver
    address recipient =
      ISynthereumFinder(finder).getImplementationAddress('CommissionReceiver');
    IPool(poolData.moneyMarket).withdraw(
      address(collateral),
      amountClaimed,
      recipient
    );
  }

  function executeBuyback(
    address pool,
    address JRTAddress,
    uint256 expiration
  ) external override onlyMaintainer returns (uint256 amountClaimed) {
    // withdraw % of commission from unclaimed interest and swap it to JRT
    PoolStorage memory poolData = poolStorage[pool];
    amountClaimed = poolData.unclaimedDaoJRT;
    poolData.unclaimedDaoJRT = 0;

    // pull tokens from pool
    IERC20 collateral = ISynthereumDeployment(pool).collateralToken();
    collateral.safeTransferFrom(pool, address(this), amountClaimed);
    // redeem on aave
    IPool(poolData.moneyMarket).withdraw(
      address(collateral),
      amountClaimed,
      address(this)
    );
    // swap to JRT to final recipient
    IUniswapV2Router02 router = IUniswapV2Router02(poolData.swapRouter);
    address recipient =
      ISynthereumFinder(finder).getImplementationAddress(
        'BuybackProgramReceiver'
      );

    address[] memory tokenSwapPath = new address[](2);
    tokenSwapPath[0] = address(collateral);
    tokenSwapPath[1] = JRTAddress;

    collateral.safeIncreaseAllowance(address(router), amountClaimed);
    router.swapExactTokensForTokens(
      amountClaimed,
      0,
      tokenSwapPath,
      recipient,
      expiration
    );
  }
}
