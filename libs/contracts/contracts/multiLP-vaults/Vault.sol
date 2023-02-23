// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {BaseVaultStorage} from './BaseVault.sol';
import {IPoolVault} from '../synthereum-pool/common/interfaces/IPoolVault.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {IStandardERC20} from '../base/interfaces/IStandardERC20.sol';
import {IVault} from './interfaces/IVault.sol';
import {SynthereumFactoryAccess} from '../common/libs/FactoryAccess.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

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
  ) external override initializer nonReentrant {
    // vault initialisation
    pool = IPoolVault(_pool);
    collateralAsset = pool.collateralToken();
    overCollateralization = _overCollateralization;
    synthereumFinder = _finder;

    // // erc20 initialisation
    __ERC20_init(_lpTokenName, _lpTokenSymbol);
    __ERC20Permit_init(_lpTokenName);
  }

  function deposit(uint256 collateralAmount, address recipient)
    external
    override
    nonReentrant
    returns (uint256 lpTokensOut)
  {
    require(collateralAmount > 0, 'Zero amount');

    // transfer collateral - checks balance
    address sender = _msgSender();
    collateralAsset.transferFrom(sender, address(this), collateralAmount);

    // approve pool to pull collateral
    collateralAsset.safeApprove(address(pool), collateralAmount);

    // retrieve updated vault position on pool
    IPoolVault.LPInfo memory vaultPosition;

    // deposit collateral (activate if first deposit) into pool and trigger positions update
    uint256 netCollateralDeposited;
    uint256 actualCollateralAmount;

    if (isLpActive) {
      vaultPosition = pool.positionLPInfo(address(this));
      (netCollateralDeposited, actualCollateralAmount) = pool.addLiquidity(
        collateralAmount
      );
    } else {
      netCollateralDeposited = pool.activateLP(
        collateralAmount,
        overCollateralization
      );
      actualCollateralAmount = netCollateralDeposited;
      isLpActive = true;
      vaultPosition.coverage = PreciseUnitMath.MAX_UINT_256;
      emit LPActivated(collateralAmount, overCollateralization);
    }

    if (
      vaultPosition.coverage >=
      PreciseUnitMath.PRECISE_UNIT + overCollateralization
    ) {
      // calculate rate
      (uint256 rate, ) =
        calculateRate(actualCollateralAmount - netCollateralDeposited);

      // mint LP tokens to user
      lpTokensOut = netCollateralDeposited.div(rate);
      _mint(recipient, lpTokensOut);

      // log event
      emit Deposit(netCollateralDeposited, lpTokensOut, rate, 0);
    } else {
      // calculate rate and discounted rate
      (uint256 rate, uint256 discountedRate, uint256 maxCollateralAtDiscount) =
        calculateDiscountedRate(
          vaultPosition,
          actualCollateralAmount - netCollateralDeposited
        );

      // mint LP tokens to user
      lpTokensOut = netCollateralDeposited > maxCollateralAtDiscount
        ? maxCollateralAtDiscount.div(discountedRate) +
          (netCollateralDeposited - maxCollateralAtDiscount).div(rate)
        : netCollateralDeposited.div(discountedRate);

      _mint(recipient, lpTokensOut);

      // log event
      emit Deposit(netCollateralDeposited, lpTokensOut, rate, discountedRate);
    }
  }

  function withdraw(uint256 lpTokensAmount, address recipient)
    external
    override
    nonReentrant
    returns (uint256 collateralOut)
  {
    require(lpTokensAmount > 0, 'Zero amount');

    // retrieve updated vault position on pool
    uint256 vaultCollateralAmount =
      (pool.positionLPInfo(address(this))).actualCollateralAmount;

    // calculate rate and amount of collateral to withdraw
    (uint256 rate, uint256 totSupply) = calculateRate(vaultCollateralAmount);
    uint256 collateralEquivalent =
      lpTokensAmount == totSupply
        ? vaultCollateralAmount
        : lpTokensAmount.mul(rate);

    // Burn LP tokens of user
    _burn(_msgSender(), lpTokensAmount);

    // withdraw collateral from pool
    (, collateralOut, ) = pool.removeLiquidity(collateralEquivalent);

    // transfer to user the net collateral out
    collateralAsset.safeTransfer(recipient, collateralOut);

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
    (rate, ) = calculateRate(
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
    if (
      vaultPosition.coverage >=
      PreciseUnitMath.PRECISE_UNIT + overCollateralization
    ) {
      return (0, 0);
    }

    // otherwise calculate discount
    (, discountedRate, maxCollateralDiscounted) = calculateDiscountedRate(
      vaultPosition,
      vaultPosition.actualCollateralAmount
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

  function getOvercollateralization()
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
    returns (uint256 rate, uint256 totalSupplyLPTokens)
  {
    // get LP tokens total supply
    totalSupplyLPTokens = totalSupply();

    // calculate rate
    rate = totalSupplyLPTokens == 0
      ? 10**IStandardERC20(address(collateralAsset)).decimals()
      : positionCollateralAmount.div(totalSupplyLPTokens);
  }

  function calculateDiscountedRate(
    IPoolVault.LPInfo memory vaultPosition,
    uint256 actualCollateralAmount
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
    (rate, ) = calculateRate(actualCollateralAmount);

    // collateralExpected = numTokens * price * overcollateralization
    // numTokens * price * overCollateralization = actualCollateral * overColl / coverage - 1;
    uint256 collateralExpected =
      (actualCollateralAmount).mul(overCollateralization).div(
        vaultPosition.coverage - PreciseUnitMath.PRECISE_UNIT
      );

    // collateral deficit = collateralExpected - actualCollateral
    collateralDeficit = collateralExpected - actualCollateralAmount;

    // discount = collateralDeficit / collateralExpected
    // discounted rate = rate - (rate * discount)
    discountedRate = rate - rate.mul(collateralDeficit.div(collateralExpected));
  }
}
