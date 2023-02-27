// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumPriceFeed} from '../oracle/interfaces/IPriceFeed.sol';
import {PoolMock} from './PoolMock.sol';
import {IPoolVault} from '../synthereum-pool/common/interfaces/IPoolVault.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  IPublicVaultRegistry
} from '../core/registries/interfaces/IPublicVaultRegistry.sol';

contract PoolMockForVault is IPoolVault {
  IPoolVault.LPInfo public position; // vault position

  uint8 private poolVersion;
  IERC20 private collateralCurrency;
  string private tokenSymbol;
  IERC20 private token;
  bytes32 private priceId;

  constructor(
    uint8 _version,
    IERC20 _collateralCurrency,
    string memory _syntheticTokenSymbol,
    IERC20 _syntheticToken,
    bytes32 id
  ) {
    poolVersion = _version;
    collateralCurrency = _collateralCurrency;
    tokenSymbol = _syntheticTokenSymbol;
    token = _syntheticToken;
    priceId = id;
  }

  function activateLP(uint256 _collateralAmount, uint128 _overCollateralization)
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
    returns (uint256 collateralDeposited, uint256 newLpCollateralAmount)
  {
    this.collateralToken().transferFrom(
      msg.sender,
      address(this),
      _collateralAmount
    );
    position.actualCollateralAmount += _collateralAmount;
    collateralDeposited = _collateralAmount;
    newLpCollateralAmount = position.actualCollateralAmount;
  }

  function removeLiquidity(uint256 _collateralAmount)
    external
    override
    returns (
      uint256 collateralRemoved,
      uint256 collateralReceived,
      uint256 newLpCollateralAmount
    )
  {
    this.collateralToken().transfer(msg.sender, _collateralAmount);
    position.actualCollateralAmount -= _collateralAmount;
    collateralReceived = _collateralAmount;
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

  function setOvercollateralization(uint128 _overCollateralization) external {
    position.overCollateralization = _overCollateralization;
  }

  function setUtilization(uint256 utilization) external {
    position.utilization = utilization;
  }

  function setCoverage(uint256 coverage) external {
    position.coverage = coverage;
  }

  function positionLPInfo(address)
    external
    view
    override
    returns (IPoolVault.LPInfo memory info)
  {
    info = position;
  }

  function priceFeedIdentifier() external view returns (bytes32 identifier) {
    identifier = priceId;
  }

  function collateralToken() external view override returns (IERC20) {
    return collateralCurrency;
  }

  function syntheticTokenSymbol() external view returns (string memory) {
    return tokenSymbol;
  }

  function syntheticToken() external view returns (IERC20) {
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
    returns (ISynthereumFinder finder)
  {}

  function version() external pure returns (uint8 contractVersion) {
    contractVersion = 6;
  }

  function typology() external pure returns (string memory typologyString) {
    typologyString = 'POOL';
  }

  function removeVaultFromRegistry(address registry, address vault) external {
    IPublicVaultRegistry(registry).removeVault(vault);
  }
}
