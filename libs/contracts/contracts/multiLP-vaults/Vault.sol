// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {BaseVaultStorage} from './BaseVault.sol';
import {IPoolVault} from './interfaces/IPoolVault.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {IVault} from './interfaces/IVault.sol';
import {SynthereumFactoryAccess} from '../common/libs/FactoryAccess.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {ERC2771Context} from '../common/ERC2771Context.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  ContextUpgradeable
} from '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';

contract Vault is IVault, BaseVaultStorage {
  using SafeERC20 for IERC20;
  using PreciseUnitMath for uint256;

  modifier onlyPoolFactory() {
    SynthereumFactoryAccess._onlyPoolFactory(synthereumFinder);
    _;
  }

  constructor() public {
    _disableInitializers();
  }

  function initialize(
    string memory _lpTokenName,
    string memory _lpTokenSymbol,
    address _pool,
    uint128 _overCollateralization,
    ISynthereumFinder _finder
  ) external override nonReentrant initializer() {
    // vault initialisation
    pool = IPoolVault(_pool);
    collateralAsset = pool.collateralToken();
    overCollateralization = _overCollateralization;
    synthereumFinder = _finder;

    // // erc20 initialisation
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
    collateralAsset.transferFrom(_msgSender(), address(this), collateralAmount);

    // approve pool to pull collateral
    collateralAsset.safeApprove(address(pool), collateralAmount);

    // retrieve updated vault position on pool
    IPoolVault.LPInfo memory vaultPosition = pool.positionLPInfo(address(this));
    address sender = _msgSender();

    // deposit collateral (activate if first deposit) into pool and trigger positions update
    uint256 netCollateralDeposited;
    if (isLpActive) {
      (netCollateralDeposited, ) = pool.addLiquidity(collateralAmount);
    } else {
      netCollateralDeposited = pool.activateLP(
        collateralAmount,
        overCollateralization
      );
      isLpActive = true;
      emit LPActivated(collateralAmount, overCollateralization);
    }

    if (vaultPosition.isOvercollateralized) {
      // calculate rate
      uint256 rate = calculateRate(vaultPosition.actualCollateralAmount);

      // mint LP tokens to user
      lpTokensOut = netCollateralDeposited.div(rate);
      _mint(sender, lpTokensOut);

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

      _mint(sender, lpTokensOut);

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

    // retrieve updated vault position on pool
    uint256 vaultCollateralAmount =
      (pool.positionLPInfo(address(this))).actualCollateralAmount;

    // calculate rate and amount of collateral to withdraw
    uint256 rate = calculateRate(vaultCollateralAmount);
    uint256 collateralEquivalent = rate.mul(lpTokensAmount);
    address sender = _msgSender();

    // Burn LP tokens of user
    _burn(sender, lpTokensAmount);

    // withdraw collateral from pool
    (, collateralOut, ) = pool.removeLiquidity(collateralEquivalent);

    // transfer to user the net collateral out
    collateralAsset.safeTransfer(sender, collateralOut);

    emit Withdraw(lpTokensAmount, collateralOut, rate);
  }

  function setReferencePool(address _newPool)
    external
    override
    onlyPoolFactory
  {
    pool = IPoolVault(_newPool);
  }

  function getRate() external view override returns (uint256 rate) {
    rate = calculateRate(
      (pool.positionLPInfo(address(this))).actualCollateralAmount
    );
  }

  function getDiscountedRate()
    external
    view
    override
    returns (uint256 discountedRate, uint256 maxCollateralDiscounted)
  {
    IPoolVault.LPInfo memory vaultPosition = pool.positionLPInfo(address(this));

    // return zeros if not in discount state
    if (vaultPosition.isOvercollateralized) {
      return (0, 0);
    }

    // otherwise calculate discount
    (, discountedRate, maxCollateralDiscounted) = calculateDiscountedRate(
      vaultPosition
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
    returns (uint128 overcollateral)
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
      ? PreciseUnitMath.PRECISE_UNIT
      : positionCollateralAmount.div(totalSupplyLPTokens);
  }

  function calculateDiscountedRate(IPoolVault.LPInfo memory vaultPosition)
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

  function isTrustedForwarder(address forwarder)
    public
    view
    override
    returns (bool)
  {
    try
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.TrustedForwarder
      )
    returns (address trustedForwarder) {
      if (forwarder == trustedForwarder) {
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }

  function _msgSender()
    internal
    view
    override(ERC2771Context, ContextUpgradeable)
    returns (address sender)
  {
    return ERC2771Context._msgSender();
  }

  function _msgData()
    internal
    view
    override(ERC2771Context, ContextUpgradeable)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }
}
