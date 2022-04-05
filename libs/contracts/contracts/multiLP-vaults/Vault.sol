// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {
  ISynthereumMultiLpLiquidityPool
} from '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPool.sol';
import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {IVault} from './interfaces/IVault.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Vault is IVault {
  using SafeERC20 for IERC20;
  using SafeERC20 for IMintableBurnableERC20;
  using PreciseUnitMath for uint256;

  IMintableBurnableERC20 immutable lpToken; // vault LP token
  ISynthereumMultiLpLiquidityPool immutable pool; // reference pool
  IERC20 internal collateralAsset; // reference pool collateral token

  uint256 immutable overCollateralization; // overcollateralization of the vault position
  bool internal isLpActive;

  constructor(
    address _token,
    address _pool,
    uint256 _overCollateralization
  ) {
    lpToken = IMintableBurnableERC20(_token);
    pool = ISynthereumMultiLpLiquidityPool(_pool);
    collateralAsset = pool.collateralToken();
    overCollateralization = _overCollateralization;
  }

  // TODO isOvercollateralised should be retrieved before the adding of collateral
  function deposit(uint256 collateralAmount)
    external
    override
    returns (uint256 lpTokensOut)
  {
    require(collateralAmount > 0, 'Zero amount');

    // transfer collateral - checks balance
    collateralAsset.transferFrom(msg.sender, address(this), collateralAmount);

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

    // retrieve updated vault position on pool
    ISynthereumMultiLpLiquidityPool.LPInfo memory vaultPosition =
      pool.positionLPInfo(address(this));

    if (vaultPosition.isOvercollateralized) {
      // calculate regular rate
      uint256 rate =
        calculateRate(
          netCollateralDeposited,
          vaultPosition.actualCollateralAmount
        );

      // mint LP tokens to user
      lpTokensOut = netCollateralDeposited.div(rate);
      lpToken.mint(msg.sender, lpTokensOut);

      // log event
      emit Deposit(netCollateralDeposited, lpTokensOut);
    } else {
      // TODO discounted rate
    }
  }

  function withdraw(uint256 lpTokensAmount)
    external
    override
    returns (uint256 collateralOut)
  {
    require(lpTokensAmount > 0, 'Zero amount');

    // Transfer LP tokens from user
    lpToken.safeTransferFrom(msg.sender, address(this), lpTokensAmount);

    // Burn LP tokens
    lpToken.burn(lpTokensAmount);

    // retrieve updated vault position on pool
    ISynthereumMultiLpLiquidityPool.LPInfo memory vaultPosition =
      pool.positionLPInfo(address(this));

    // calculate rate and amount of collateral to withdraw
    uint256 collateralEquivalent =
      calculateRate(0, vaultPosition.actualCollateralAmount).mul(
        lpTokensAmount
      );

    // withdraw collateral from pool
    collateralOut = pool.removeLiquidity(collateralEquivalent);

    // transfer to user
    collateralAsset.safeTransfer(msg.sender, collateralOut);

    emit Withdraw(lpTokensAmount, collateralOut);
  }

  function calculateRate(
    uint256 netCollateralDeposited,
    uint256 positionCollateralAmount
  ) internal returns (uint256 rate) {
    // get LP tokens total supply
    uint256 totalSupplyLPTokens = lpToken.totalSupply();

    // calculate rate
    rate = totalSupplyLPTokens == 0 ? 1 : netCollateralDeposited > 0
      ? (positionCollateralAmount - netCollateralDeposited).div(
        totalSupplyLPTokens
      ) // deposit case
      : positionCollateralAmount.div(totalSupplyLPTokens); // withdraw case
  }

  function calculateDiscountedRate(
    uint256 netCollateralDeposited,
    uint256 positionCollateralAmount
  )
    internal
    returns (
      uint256 rate,
      uint256 discountedRate,
      uint256 maxCollateralDiscounted
    )
  {}
}
