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
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {SynthereumFactoryAccess} from '../common/libs/FactoryAccess.sol';
import {BaseVaultStorage} from './BaseVault.sol';

contract Vault is IVault, BaseVaultStorage {
  using SafeERC20 for IERC20;
  using PreciseUnitMath for uint256;

  struct DepositCache {
    uint256 netCollateralDeposited;
    uint256 actualCollateralAmount;
    uint256 spreadAdjustedCollateral;
    uint256 fee;
    uint256 rate;
    uint256 discountedRate;
    uint256 totalSupply;
    uint256 vaultCoverage;
    uint128 overCollateralFactor;
  }

  struct WithdrawCache {
    uint256 vaultCollateralAmount;
    uint256 totSupply;
    uint256 scalingValue;
    uint256 rate;
    uint256 collateralEquivalent;
  }

  struct FeeCache {
    uint256 positionCollateral;
    uint256 amount;
    uint256 lpShare;
    uint256 totalShares;
    uint256 coverage;
    bool isDeposit;
  }

  modifier onlyVaultRegistry() {
    address vaultRegistry = synthereumFinder.getImplementationAddress(
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

    // struct to cache intermediate values
    DepositCache memory cache;

    // deposit collateral (activate if first deposit) into pool and trigger positions update
    cache.totalSupply = totalSupply();
    cache.overCollateralFactor = overCollateralization;

    if (isLpActive) {
      vaultPosition = pool.positionLPInfo(address(this));
      (cache.netCollateralDeposited, cache.actualCollateralAmount) = pool
        .addLiquidity(collateralAmount);
      if (cache.totalSupply == 0) {
        vaultPosition.coverage = PreciseUnitMath.MAX_UINT_256;
      }
    } else {
      cache.netCollateralDeposited = pool.activateLP(
        collateralAmount,
        cache.overCollateralFactor
      );
      cache.actualCollateralAmount = cache.netCollateralDeposited;
      vaultPosition.coverage = PreciseUnitMath.MAX_UINT_256;
      isLpActive = true;
      emit LPActivated(collateralAmount, cache.overCollateralFactor);
    }

    uint256 scalingValue = scalingFactor();
    cache.vaultCoverage = vaultPosition.coverage;

    if (
      cache.vaultCoverage >=
      PreciseUnitMath.PRECISE_UNIT + cache.overCollateralFactor
    ) {
      if (cache.totalSupply != 0) {
        (cache.spreadAdjustedCollateral, cache.fee) = applySpread(
          FeeCache(
            vaultPosition.actualCollateralAmount,
            cache.netCollateralDeposited,
            cache.netCollateralDeposited,
            cache.actualCollateralAmount,
            cache.vaultCoverage,
            true
          )
        );
      } else {
        cache.spreadAdjustedCollateral = cache.netCollateralDeposited;
      }
      // calculate rate
      cache.rate = calculateRate(
        cache.actualCollateralAmount - cache.netCollateralDeposited + cache.fee,
        cache.totalSupply,
        scalingValue
      );

      lpTokensOut = (cache.spreadAdjustedCollateral * scalingValue).div(
        cache.rate
      );
    } else {
      // calculate rate and discounted rate
      uint256 maxCollateralAtDiscount;

      (
        ,
        cache.discountedRate,
        maxCollateralAtDiscount
      ) = calculateDiscountedRate(
        vaultPosition,
        cache.actualCollateralAmount - cache.netCollateralDeposited,
        cache.totalSupply,
        scalingValue,
        cache.overCollateralFactor
      );

      if (cache.netCollateralDeposited <= maxCollateralAtDiscount) {
        lpTokensOut = (cache.netCollateralDeposited * scalingValue).div(
          cache.discountedRate
        );
      } else {
        uint256 remainingCollateral = cache.netCollateralDeposited -
          maxCollateralAtDiscount;
        (cache.spreadAdjustedCollateral, cache.fee) = applySpread(
          FeeCache(
            vaultPosition.actualCollateralAmount,
            remainingCollateral,
            remainingCollateral,
            cache.actualCollateralAmount,
            cache.vaultCoverage,
            true
          )
        );

        cache.rate = calculateRate(
          cache.actualCollateralAmount -
            cache.netCollateralDeposited +
            cache.fee,
          cache.totalSupply,
          scalingValue
        );

        lpTokensOut =
          (maxCollateralAtDiscount * scalingValue).div(cache.discountedRate) +
          (cache.spreadAdjustedCollateral * scalingValue).div(cache.rate);
      }
    }

    // mint LP tokens to user
    _mint(recipient, lpTokensOut);

    // log event
    emit Deposit(
      msg.sender,
      cache.netCollateralDeposited,
      lpTokensOut,
      cache.rate,
      cache.discountedRate
    );
  }

  function withdraw(uint256 lpTokensAmount, address recipient)
    external
    override
    nonReentrant
    returns (uint256 collateralOut)
  {
    require(lpTokensAmount > 0, 'Zero amount');

    // retrieve updated vault position on pool
    IPoolVault.LPInfo memory vaultPosition = pool.positionLPInfo(address(this));

    WithdrawCache memory cache;

    cache.vaultCollateralAmount = vaultPosition.actualCollateralAmount;

    // calculate rate and amount of collateral to withdraw
    cache.totSupply = totalSupply();
    cache.scalingValue = scalingFactor();
    cache.rate = calculateRate(
      cache.vaultCollateralAmount,
      cache.totSupply,
      cache.scalingValue
    );
    cache.collateralEquivalent = lpTokensAmount == cache.totSupply
      ? cache.vaultCollateralAmount
      : lpTokensAmount.mul(cache.rate) / cache.scalingValue;

    // Burn LP tokens of user
    _burn(_msgSender(), lpTokensAmount);

    // withdraw collateral from pool
    (uint256 spreadAdjustedCollateral, ) = applySpread(
      FeeCache(
        cache.vaultCollateralAmount,
        cache.collateralEquivalent,
        lpTokensAmount,
        cache.totSupply,
        vaultPosition.coverage,
        false
      )
    );
    (, collateralOut, ) = pool.removeLiquidity(spreadAdjustedCollateral);

    // transfer to user the net collateral out
    collateralAsset.safeTransfer(recipient, collateralOut);

    emit Withdraw(msg.sender, lpTokensAmount, collateralOut, cache.rate);
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
    returns (
      uint256 rate,
      uint256 discountedRate,
      uint256 maxCollateralDiscounted
    )
  {
    IPoolVault.LPInfo memory vaultPosition = pool.positionLPInfo(address(this));

    // return zeros if not in discount state
    uint128 overCollateralFactor = overCollateralization;
    if (
      vaultPosition.coverage >=
      PreciseUnitMath.PRECISE_UNIT + overCollateralFactor
    ) {
      return (
        calculateRate(
          vaultPosition.actualCollateralAmount,
          totalSupply(),
          scalingFactor()
        ),
        0,
        0
      );
    }

    // otherwise calculate discount
    (rate, discountedRate, maxCollateralDiscounted) = calculateDiscountedRate(
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

  function getSpread()
    external
    view
    override
    returns (uint256 maxSpreadLong, uint256 maxSpreadShort)
  {
    ISynthereumPriceFeed priceFeed = ISynthereumPriceFeed(
      synthereumFinder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
    );

    maxSpreadLong = priceFeed.longMaxSpread(priceFeedIdentifier);
    maxSpreadShort = priceFeed.shortMaxSpread(priceFeedIdentifier);
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
    uint256 collateralExpected = (actualCollateralAmount)
      .mul(overCollateralFactor)
      .div(vaultPosition.coverage - PreciseUnitMath.PRECISE_UNIT);

    // collateral deficit = collateralExpected - actualCollateral
    collateralDeficit = collateralExpected - actualCollateralAmount;

    // discount = collateralDeficit / collateralExpected
    // discounted rate = rate - (rate * discount)
    discountedRate = rate - rate.mul(collateralDeficit.div(collateralExpected));
  }

  // apply spread % based on price feed spread
  function applySpread(FeeCache memory _feeCache)
    internal
    view
    returns (uint256 adjustedAmount, uint256 fee)
  {
    ISynthereumPriceFeed priceFeed = ISynthereumPriceFeed(
      synthereumFinder.getImplementationAddress(SynthereumInterfaces.PriceFeed)
    );

    uint256 maxSpread = _feeCache.isDeposit
      ? priceFeed.shortMaxSpread(priceFeedIdentifier)
      : priceFeed.longMaxSpread(priceFeedIdentifier);

    fee = _feeCache
      .positionCollateral
      .mul(_feeCache.lpShare)
      .mul(maxSpread)
      .div(_feeCache.coverage - PreciseUnitMath.PRECISE_UNIT)
      .div(_feeCache.totalShares);

    adjustedAmount = _feeCache.amount - fee;
  }
}
