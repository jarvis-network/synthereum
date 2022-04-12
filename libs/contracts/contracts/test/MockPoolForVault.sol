// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumPriceFeed} from '../oracle/interfaces/IPriceFeed.sol';
import {PoolMock} from './PoolMock.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPool.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';

contract PoolMockForVault is ISynthereumMultiLpLiquidityPool {
  LPInfo public position; // vault position

  uint8 private poolVersion;
  IERC20 private collateralCurrency;
  string private tokenSymbol;
  IERC20 private token;

  constructor(
    uint8 _version,
    IERC20 _collateralCurrency,
    string memory _syntheticTokenSymbol,
    IERC20 _syntheticToken
  ) {
    poolVersion = _version;
    collateralCurrency = _collateralCurrency;
    tokenSymbol = _syntheticTokenSymbol;
    token = _syntheticToken;
  }

  function initialize(InitializationParams calldata _params)
    external
    override
  {}

  function registerLP(address _lp) external override {}

  function activateLP(uint256 _collateralAmount, uint256 _overCollateralization)
    external
    override
    returns (uint256 collateralDeposited)
  {
    this.collateralToken().transferFrom(
      msg.sender,
      address(this),
      _collateralAmount
    );
    this.setOvercollateralization(_overCollateralization);
    position.actualCollateralAmount = _collateralAmount;
    collateralDeposited = _collateralAmount;
  }

  function addLiquidity(uint256 _collateralAmount)
    external
    override
    returns (uint256 collateralDeposited)
  {
    this.collateralToken().transferFrom(
      msg.sender,
      address(this),
      _collateralAmount
    );
    position.actualCollateralAmount += _collateralAmount;
    collateralDeposited = _collateralAmount;
  }

  function removeLiquidity(uint256 _collateralAmount)
    external
    override
    returns (uint256 collateralWithdrawn)
  {
    this.collateralToken().transfer(msg.sender, _collateralAmount);
    position.actualCollateralAmount -= _collateralAmount;
    collateralWithdrawn = _collateralAmount;
  }

  function addInterestToPosition(uint256 _interest) public {
    this.collateralToken().transferFrom(msg.sender, address(this), _interest);
    position.actualCollateralAmount += _interest;
  }

  function addPNL(bool isProfit, uint256 amount) public {
    isProfit
      ? position.actualCollateralAmount += amount
      : position.actualCollateralAmount -= amount;
  }

  function setPositionOvercollateralised(bool isCollateralised) external {
    position.isOvercollateralized = isCollateralised;
  }

  function setOvercollateralization(uint256 _overCollateralization) external {
    position.overCollateralization = _overCollateralization;
  }

  function setUtilization(uint256 utilization) external {
    position.utilization = utilization;
  }

  function mint(MintParams calldata mintParams)
    external
    override
    returns (uint256 syntheticTokensMinted, uint256 feePaid)
  {}

  function redeem(RedeemParams calldata redeemParams)
    external
    override
    returns (uint256 collateralRedeemed, uint256 feePaid)
  {}

  function liquidate(address lp, uint256 numSynthTokens)
    external
    override
    returns (uint256)
  {}

  function updatePositions() external override {}

  function transferToLendingManager(uint256 _bearingAmount) external override {}

  function setLiquidationReward(uint256 _newLiquidationReward)
    external
    override
  {}

  function setFee(uint256 _fee) external override {}

  function switchLendingModule(
    string calldata _lendingId,
    address _bearingToken
  ) external override {}

  function getRegisteredLPs()
    external
    view
    override
    returns (address[] memory lps)
  {}

  function getActiveLPs()
    external
    view
    override
    returns (address[] memory lps)
  {}

  function isRegisteredLP(address _lp)
    external
    view
    override
    returns (bool isRegistered)
  {}

  function isActiveLP(address _lp)
    external
    view
    override
    returns (bool isActive)
  {}

  function totalSyntheticTokens()
    external
    view
    override
    returns (uint256 totalTokens)
  {}

  function totalCollateralAmount()
    external
    view
    override
    returns (
      uint256 usersCollateral,
      uint256 lpsCollateral,
      uint256 totalCollateral
    )
  {}

  function totalAvailableLiquidity()
    external
    view
    override
    returns (uint256 totalLiquidity)
  {}

  function positionLPInfo(address _lp)
    external
    view
    override
    returns (LPInfo memory info)
  {
    info = position;
  }

  function lendingProtocolInfo()
    external
    view
    override
    returns (string memory lendingId, address bearingToken)
  {}

  function collateralTokenDecimals() external view override returns (uint8) {}

  function collateralRequirement()
    external
    view
    override
    returns (uint256 requirement)
  {}

  function liquidationReward()
    external
    view
    override
    returns (uint256 reward)
  {}

  function priceFeedIdentifier()
    external
    view
    override
    returns (bytes32 identifier)
  {}

  function feePercentage() external view override returns (uint256 fee) {}

  function typology() external view override returns (string memory) {}

  function version() external view returns (uint8) {
    return poolVersion;
  }

  function collateralToken() external view override returns (IERC20) {
    return collateralCurrency;
  }

  function syntheticTokenSymbol()
    external
    view
    override
    returns (string memory)
  {
    return tokenSymbol;
  }

  function syntheticToken() external view override returns (IERC20) {
    return token;
  }

  function getRate(address priceFeed, bytes32 identifier)
    external
    view
    returns (uint256)
  {
    return ISynthereumPriceFeed(priceFeed).getLatestPrice(identifier);
  }

  function synthereumFinder()
    external
    view
    override
    returns (ISynthereumFinder finder)
  {}
}
