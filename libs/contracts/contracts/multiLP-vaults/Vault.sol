// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {IStandardERC20} from '../base/interfaces/IStandardERC20.sol';
import {IPoolVault} from '../synthereum-pool/common/interfaces/IPoolVault.sol';
import {IVault} from './interfaces/IVault.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {ISynthereumPriceFeed} from '../oracle/interfaces/IPriceFeed.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {SynthereumFactoryAccess} from '../common/libs/FactoryAccess.sol';
import {BaseVaultStorage} from './BaseVault.sol';

contract Vault is IVault, BaseVaultStorage {
  using SafeERC20 for IERC20;
  using PreciseUnitMath for uint256;

  modifier onlyVaultRegistry() {
    address vaultRegistry =
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.VaultRegistry
      );
    require(msg.sender == vaultRegistry, 'Sender must be vault registry');
    _;
  }

  constructor() {
    version = 1;
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
    priceFeedIdentifier = pool.priceFeedIdentifier();
    collateralAsset = pool.collateralToken();
    overCollateralization = _overCollateralization;
    synthereumFinder = _finder;
    collateralDecimals = IStandardERC20(address(collateralAsset)).decimals();
    version = 1;

    // // reentrancy and erc20 initialisation
    __ReentrancyGuard_init();
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
    collateralAsset.transferFrom(_msgSender(), address(this), collateralAmount);

    // approve pool to pull collateral
    collateralAsset.safeApprove(address(pool), collateralAmount);

    // retrieve updated vault position on pool
    IPoolVault.LPInfo memory vaultPosition;

    // deposit collateral (activate if first deposit) into pool and trigger positions update
    uint256 netCollateralDeposited;
    uint256 actualCollateralAmount;
    uint256 spreadAdjustedCollateral;
    uint256 totalSupply = totalSupply();
    uint128 overCollateralFactor = overCollateralization;

    if (isLpActive) {
      vaultPosition = pool.positionLPInfo(address(this));
      (netCollateralDeposited, actualCollateralAmount) = pool.addLiquidity(
        collateralAmount
      );
      if (totalSupply == 0) {
        vaultPosition.coverage = PreciseUnitMath.MAX_UINT_256;
        spreadAdjustedCollateral = netCollateralDeposited;
      } else {
        spreadAdjustedCollateral = applySpread(netCollateralDeposited);
      }
    } else {
      netCollateralDeposited = pool.activateLP(
        collateralAmount,
        overCollateralFactor
      );
      actualCollateralAmount = netCollateralDeposited;
      spreadAdjustedCollateral = netCollateralDeposited;
      isLpActive = true;
      vaultPosition.coverage = PreciseUnitMath.MAX_UINT_256;
      emit LPActivated(collateralAmount, overCollateralFactor);
    }
    uint256 scalingValue = scalingFactor();
    if (
      vaultPosition.coverage >=
      PreciseUnitMath.PRECISE_UNIT + overCollateralFactor
    ) {
      // calculate rate
      uint256 rate =
        calculateRate(
          actualCollateralAmount - netCollateralDeposited,
          totalSupply,
          scalingValue
        );

      lpTokensOut = (spreadAdjustedCollateral * scalingValue).div(rate);
      _mint(recipient, lpTokensOut);

      // log event
      emit Deposit(netCollateralDeposited, lpTokensOut, rate, 0);
    } else {
      // calculate rate and discounted rate
      (uint256 rate, uint256 discountedRate, uint256 maxCollateralAtDiscount) =
        calculateDiscountedRate(
          vaultPosition,
          actualCollateralAmount - netCollateralDeposited,
          totalSupply,
          scalingValue,
          overCollateralFactor
        );

      // mint LP tokens to user
      lpTokensOut = spreadAdjustedCollateral > maxCollateralAtDiscount
        ? (maxCollateralAtDiscount * scalingValue).div(discountedRate) +
          ((spreadAdjustedCollateral - maxCollateralAtDiscount) * scalingValue)
            .div(rate)
        : (spreadAdjustedCollateral * scalingValue).div(discountedRate);

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
    uint256 totSupply = totalSupply();
    uint256 scalingValue = scalingFactor();
    uint256 rate =
      calculateRate(vaultCollateralAmount, totSupply, scalingValue);
    uint256 collateralEquivalent =
      lpTokensAmount == totSupply
        ? vaultCollateralAmount
        : lpTokensAmount.mul(rate) / scalingValue;

    // Burn LP tokens of user
    _burn(_msgSender(), lpTokensAmount);

    // withdraw collateral from pool
    (, collateralOut, ) = pool.removeLiquidity(collateralEquivalent);

    // transfer to user the net collateral out
    collateralAsset.safeTransfer(recipient, collateralOut);

    emit Withdraw(lpTokensAmount, collateralOut, rate);
  }

  function setReferencePool(address newPool)
    external
    override
    onlyVaultRegistry
  {
    pool = IPoolVault(newPool);
  }

  function getRate() external view override returns (uint256 rate) {
    rate = calculateRate(
      (pool.positionLPInfo(address(this))).actualCollateralAmount,
      totalSupply(),
      scalingFactor()
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
    uint128 overCollateralFactor = overCollateralization;
    if (
      vaultPosition.coverage >=
      PreciseUnitMath.PRECISE_UNIT + overCollateralFactor
    ) {
      return (0, 0);
    }

    // otherwise calculate discount
    (, discountedRate, maxCollateralDiscounted) = calculateDiscountedRate(
      vaultPosition,
      vaultPosition.actualCollateralAmount,
      totalSupply(),
      scalingFactor(),
      overCollateralFactor
    );
  }

  function getVersion() external view override returns (uint256) {
    return version;
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

  function getSpread() external view override returns (uint256 maxSpread) {
    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.PriceFeed
        )
      );

    maxSpread = priceFeed.getMaxSpread(priceFeedIdentifier);
  }

  function scalingFactor() internal view returns (uint256) {
    return 10**(18 - collateralDecimals);
  }

  function calculateRate(
    uint256 positionCollateralAmount,
    uint256 totalSupply,
    uint256 scalingValue
  ) internal pure returns (uint256 rate) {
    // calculate rate
    rate = totalSupply == 0
      ? PreciseUnitMath.PRECISE_UNIT
      : (positionCollateralAmount * scalingValue).div(totalSupply);
  }

  function calculateDiscountedRate(
    IPoolVault.LPInfo memory vaultPosition,
    uint256 actualCollateralAmount,
    uint256 totalSupply,
    uint256 scalingValue,
    uint256 overCollateralFactor
  )
    internal
    pure
    returns (
      uint256 rate,
      uint256 discountedRate,
      uint256 collateralDeficit
    )
  {
    // get regular rate
    rate = calculateRate(actualCollateralAmount, totalSupply, scalingValue);

    // collateralExpected = numTokens * price * overcollateralization
    // numTokens * price * overCollateralization = actualCollateral * overColl / coverage - 1;
    uint256 collateralExpected =
      (actualCollateralAmount).mul(overCollateralFactor).div(
        vaultPosition.coverage - PreciseUnitMath.PRECISE_UNIT
      );

    // collateral deficit = collateralExpected - actualCollateral
    collateralDeficit = collateralExpected - actualCollateralAmount;

    // discount = collateralDeficit / collateralExpected
    // discounted rate = rate - (rate * discount)
    discountedRate = rate - rate.mul(collateralDeficit.div(collateralExpected));
  }

  // apply spread % based on price feed spread
  function applySpread(uint256 collateralAmount)
    internal
    view
    returns (uint256 adjustedAmount)
  {
    ISynthereumPriceFeed priceFeed =
      ISynthereumPriceFeed(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.PriceFeed
        )
      );

    uint256 maxSpread = priceFeed.getMaxSpread(priceFeedIdentifier);
    adjustedAmount = collateralAmount - collateralAmount.mul(maxSpread);
  }
}
