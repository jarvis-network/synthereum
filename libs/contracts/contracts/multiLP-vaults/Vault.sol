// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {
  ISynthereumMultiLpLiquidityPool
} from '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPool.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {IVault} from './interfaces/IVault.sol';
import {
  ERC20PermitUpgradeable
} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol';
import {
  ERC20Upgradeable
} from '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract Vault is
  IVault,
  ERC20Upgradeable,
  ERC20PermitUpgradeable,
  ReentrancyGuard
{
  using SafeERC20 for IERC20;
  using PreciseUnitMath for uint256;

  // IMintableBurnableERC20 immutable lpToken; // vault LP token
  ISynthereumMultiLpLiquidityPool internal pool; // reference pool
  IERC20 internal collateralAsset; // reference pool collateral token

  uint256 internal overCollateralization; // overcollateralization of the vault position
  bool internal isLpActive; // dictates if first deposit on pool or not

  function initialize(
    string memory _lpTokenName,
    string memory _lpTokenSymbol,
    address _pool,
    uint256 _overCollateralization
  ) external override nonReentrant initializer() {
    // vault initialisation
    pool = ISynthereumMultiLpLiquidityPool(_pool);
    collateralAsset = pool.collateralToken();
    overCollateralization = _overCollateralization;

    // erc20 initialisation
    __ERC20_init(_lpTokenName, _lpTokenSymbol);
    __ERC20Permit_init(_lpTokenName);
  }

  function deposit(uint256 collateralAmount)
    external
    override
    returns (uint256 lpTokensOut)
  {
    require(collateralAmount > 0, 'Zero amount');

    // transfer collateral - checks balance
    collateralAsset.transferFrom(msg.sender, address(this), collateralAmount);

    // retrieve updated vault position on pool
    ISynthereumMultiLpLiquidityPool.LPInfo memory vaultPosition =
      pool.positionLPInfo(address(this));

    // deposit collateral (activate if first deposit) into pool and trigger positions update
    uint256 netCollateralDeposited;
    if (isLpActive) {
      netCollateralDeposited = pool.addLiquidity(collateralAmount);
    } else {
      netCollateralDeposited = pool.activateLP(
        collateralAmount,
        overCollateralization
      );
      isLpActive = true;
    }

    if (vaultPosition.isOvercollateralized) {
      // calculate rate
      uint256 rate = calculateRate(vaultPosition.actualCollateralAmount);

      // mint LP tokens to user
      lpTokensOut = netCollateralDeposited.div(rate);
      _mint(msg.sender, lpTokensOut);

      // log event
      emit Deposit(netCollateralDeposited, lpTokensOut, rate, 0);
    } else {
      // calculate rate and discounted rate
      (uint256 rate, uint256 discountedRate, uint256 maxCollateralAtDiscount) =
        calculateDiscountedRate(vaultPosition);

      // mint LP tokens to user
      lpTokensOut = netCollateralDeposited > maxCollateralAtDiscount
        ? maxCollateralAtDiscount.div(discountedRate) +
          (netCollateralDeposited - maxCollateralAtDiscount).div(rate)
        : netCollateralDeposited.div(discountedRate);

      _mint(msg.sender, lpTokensOut);

      // log event
      emit Deposit(netCollateralDeposited, lpTokensOut, rate, discountedRate);
    }
  }

  function withdraw(uint256 lpTokensAmount)
    external
    override
    returns (uint256 collateralOut)
  {
    require(lpTokensAmount > 0, 'Zero amount');

    // Burn LP tokens of user
    _burn(msg.sender, lpTokensAmount);

    // retrieve updated vault position on pool
    uint256 vaultCollateralAmount =
      (pool.positionLPInfo(address(this))).actualCollateralAmount;

    // calculate rate and amount of collateral to withdraw
    uint256 rate = calculateRate(vaultCollateralAmount);
    uint256 collateralEquivalent = rate.mul(lpTokensAmount);

    // withdraw collateral from pool
    collateralOut = pool.removeLiquidity(collateralEquivalent);

    // transfer to user the net collateral out
    collateralAsset.safeTransfer(msg.sender, collateralOut);

    emit Withdraw(lpTokensAmount, collateralOut, rate);
  }

  function getRate()
    external
    view
    override
    returns (
      uint256 rate,
      uint256 discountedRate,
      uint256 maxCollateralAtDiscount
    )
  {
    (rate, discountedRate, maxCollateralAtDiscount) = calculateDiscountedRate(
      pool.positionLPInfo(address(this))
    );
  }

  function getPool() external view override returns (address poolAddress) {
    poolAddress = address(pool);
  }

  function getPoolCollateral()
    external
    view
    override
    returns (address collateral)
  {
    collateral = address(collateralAsset);
  }

  function getOvercollateralisation()
    external
    view
    override
    returns (uint256 overcollateral)
  {
    overcollateral = overCollateralization;
  }

  function calculateRate(uint256 positionCollateralAmount)
    internal
    view
    returns (uint256 rate)
  {
    // get LP tokens total supply
    uint256 totalSupplyLPTokens = totalSupply();

    // calculate rate
    rate = totalSupplyLPTokens == 0
      ? 1
      : positionCollateralAmount.div(totalSupplyLPTokens);
  }

  function calculateDiscountedRate(
    ISynthereumMultiLpLiquidityPool.LPInfo memory vaultPosition
  )
    internal
    view
    returns (
      uint256 rate,
      uint256 discountedRate,
      uint256 collateralDeficit
    )
  {
    // get regular rate
    rate = calculateRate(vaultPosition.actualCollateralAmount);

    // collateralExpected = numTokens * price * overcollateralization
    // from LPInfo -> utilization * actualCollateralAmount
    // (numTokens * price * overCollateralization / actualCollateralAmount) * actualCollateralAmount
    uint256 collateralExpected =
      vaultPosition.utilization.mul(vaultPosition.actualCollateralAmount);

    // collateral deficit = collateralExpected - actualCollateral
    collateralDeficit =
      collateralExpected -
      vaultPosition.actualCollateralAmount;

    // discount = collateralDeficit / collateralExpected
    // discounted rate = rate - (rate * discount)
    discountedRate = rate - rate.mul(collateralDeficit.div(collateralExpected));
  }
}
