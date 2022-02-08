// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ILendingProxy} from './interfaces/ILendingProxy.sol';

import {
  IPool,
  IScaledBalanceToken
} from '@aave/aave-v3-core/contracts/interfaces/IPool.sol';
import {
  SynthereumInterfaces
} from '@jarvis-network/synthereum-contracts/contracts/core/Constants.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {
  ISynthereumDeployment
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IDeployment.sol';

contract LendingProxy is ILendingProxy {
  address public maintainer;

  mapping(address => address) public poolModule;
  mapping(address => uint256) public poolCurrentCollateralDeposited;
  mapping(address => uint256) public poolDaoInterestShare;
  mapping(address => address) public poolInterestBearingToken;
  mapping(address => uint256) public unclaimedDaoInterest;
  mapping(address => uint256) public JRTBuybackShare;

  modifier onlyPool() {
    require(poolModule[msg.sender] != address(0), 'Not allowed');
    _;
  }

  modifier onlyMaintainer() {
    require(msg.sender == maintainer, 'Only maintainter');
  }

  constructor(address _maintainer) {
    maintainer = _maintainer;
  }

  function claimCommission(address pool) public override onlyMaintainer {
    // withdraw % of commission from unclaimed interest
    uint256 amount =
      unclaimedDaoInterest[msg.sender] * (100 - JRTBuybackShare[msg.sender]);
  }

  function deposit(uint256 amount)
    public
    override
    onlyPool
    returns (uint256 poolInterest)
  {
    // retrievve pool collateral
    IERC20 collateral = ISynthereumDeployment(msg.sender).collateralToken();
    collateral.safeTransferFrom(msg.sender, address(this), amount);

    // calculate interest splitting on delta deposit
    uint256 daoInterest;
    (poolInterest, daoInterest) = calculateGeneratedInterest(amount);

    // delegate call aave deposit - approve
    IPool(poolModule[msg.sender]).deposit(collateral, amount, msg.sender, '');

    // update poolLastDeposit
    poolCurrentCollateralDeposited[msg.sender] += amount;

    // update unclaimed interest
    unclaimedDaoInterest[msg.sender] += daoInterest;
  }

  function withdraw(uint256 amount, address recipient)
    public
    override
    onlyPool
    returns (poolInterest)
  {
    IERC20 collateral = ISynthereumDeployment(msg.sender).collateralToken();

    // retrieve aTokens - amount ?
    IScaledBalanceToken(poolInterestBearingToken[msg.sender]).safeTransferFrom(
      msg.sender,
      address(this),
      amount
    );

    // delegate call aave withdraw - approve
    IPool(poolModule[msg.sender].withdraw(collateral, amount, recipient));

    // calculate interest splitting on delta deposit
    uint256 daoInterest;
    (poolInterest, daoInterest) = calculateGeneratedInterest(amount);

    // update poolLastDeposit
    poolCurrentCollateralDeposited[msg.sender] -= amount;

    // update unclaimed interest
    unclaimedDaoInterest[msg.sender] += daoInterest;
  }

  function calculateGeneratedInterest()
    internal
    view
    returns (uint256 poolInterest, uint256 daoInterest)
  {
    uint256 ratio = poolDaoInterestShare[msg.sender];
    uint256 lastBalance = poolCurrentCollateralDeposited[msg.sender];

    // get current pool scaled balance of collateral (excluding daoShare of it)
    uint256 poolBalance =
      IScaledBalanceToken(poolInterestBearingToken[msg.sender]).scaledBalanceOf(
        msg.sender
      ) - unclaimedDaoInterest[msg.sender];

    // the total interest is delta between current balance and lastBalance
    uint256 totalInterestGenerated = poolBalance - lastBalance;
    daoInterest = (totalInterestGenerated * ratio) / 100;
    poolInterest = (totalInterestGenerated * (100 - ratio)) / 100;
  }
}
