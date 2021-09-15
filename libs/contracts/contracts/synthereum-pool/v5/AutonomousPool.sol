// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {ISynthereumAutonomousPool} from './interfaces/IAutonomousPool.sol';
import {
  ISynthereumAutonomousPoolStorage
} from './interfaces/IAutonomousPoolStorage.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {SynthereumAutonomousPoolLib} from './AutonomousPoolLib.sol';
import {Lockable} from '@uma/core/contracts/common/implementation/Lockable.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

/**
 * @title Token Issuer Contract
 * @notice Collects collateral and issues synthetic assets
 */
contract SynthereumAutonomousPool is
  AccessControlEnumerable,
  ISynthereumAutonomousPoolStorage,
  ISynthereumAutonomousPool,
  Lockable
{
  using SynthereumAutonomousPoolLib for Storage;

  //----------------------------------------
  // Constants
  //----------------------------------------

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  bytes32 public constant LIQUIDITY_PROVIDER_ROLE =
    keccak256('Liquidity Provider');

  //----------------------------------------
  // Storage
  //----------------------------------------

  Storage private poolStorage;

  LPPosition private lpPosition;

  Liquidation private liquidationData;

  FeeStatus private feeStatus;

  //----------------------------------------
  // Events
  //----------------------------------------

  event Mint(
    address indexed account,
    address indexed pool,
    uint256 collateralSent,
    uint256 numTokensReceived,
    uint256 feePaid,
    address recipient
  );

  event SetFeePercentage(uint256 feePercentage);

  event SetFeeRecipients(address[] feeRecipients, uint32[] feeProportions);

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice `_overCollateralization should be greater than 0
   * @param _finder The Synthereum finder
   * @param _version Synthereum version
   * @param _collateralToken ERC20 collateral token
   * @param _syntheticToken ERC20 synthetic token
   * @param _roles The addresses of admin, maintainer, liquidity provider and validator
   * @param _overCollateralization Over-collateralization ratio
   * @param _fee The fee structure
   * @param _priceIdentifier Identifier of price to be used in the price feed
   */
  constructor(
    ISynthereumFinder _finder,
    uint8 _version,
    IERC20 _collateralToken,
    IMintableBurnableERC20 _syntheticToken,
    Roles memory _roles,
    uint256 _overCollateralization,
    Fee memory _fee,
    bytes32 _priceIdentifier
  ) nonReentrant {
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(LIQUIDITY_PROVIDER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
    _setupRole(LIQUIDITY_PROVIDER_ROLE, _roles.liquidityProvider);
    poolStorage.initialize(
      _finder,
      _version,
      _collateralToken,
      _syntheticToken,
      FixedPoint.Unsigned(_overCollateralization),
      _priceIdentifier
    );
    poolStorage.setFeePercentage(_fee.feePercentage);
    poolStorage.setFeeRecipients(_fee.feeRecipients, _fee.feeProportions);
  }

  /**
   * @notice Mint synthetic tokens using fixed amount of collateral
   * @notice This calculate the price using on chain price feed
   * @notice User must approve collateral transfer for the mint request to succeed
   * @param mintParams Input parameters for minting (see MintParams struct)
   * @return syntheticTokensMinted Amount of synthetic tokens minted by a user
   * @return feePaid Amount of collateral paid by the user as fee
   */
  function mint(MintParams memory mintParams)
    external
    override
    nonReentrant
    returns (uint256 syntheticTokensMinted, uint256 feePaid)
  {
    (syntheticTokensMinted, feePaid) = poolStorage.mint(
      lpPosition,
      feeStatus,
      mintParams
    );
  }

  //----------------------------------------
  // External view functions
  //----------------------------------------

  /**
   * @notice Get Synthereum finder of the pool
   * @return finder Returns finder contract
   */
  function synthereumFinder()
    external
    view
    override
    returns (ISynthereumFinder finder)
  {
    finder = poolStorage.finder;
  }

  /**
   * @notice Get Synthereum version
   * @return poolVersion Returns the version of the Synthereum pool
   */
  function version() external view override returns (uint8 poolVersion) {
    poolVersion = poolStorage.version;
  }

  /**
   * @notice Get the collateral token
   * @return collateralCurrency The ERC20 collateral token
   */
  function collateralToken()
    external
    view
    override
    returns (IERC20 collateralCurrency)
  {
    collateralCurrency = poolStorage.collateralToken;
  }

  /**
   * @notice Get the synthetic token associated to this pool
   * @return syntheticCurrency The ERC20 synthetic token
   */
  function syntheticToken()
    external
    view
    override
    returns (IERC20 syntheticCurrency)
  {
    syntheticCurrency = poolStorage.syntheticToken;
  }

  /**
   * @notice Get the synthetic token symbol associated to this pool
   * @return symbol The ERC20 synthetic token symbol
   */
  function syntheticTokenSymbol()
    external
    view
    override
    returns (string memory symbol)
  {
    symbol = IStandardERC20(address(poolStorage.syntheticToken)).symbol();
  }

  /**
   * @notice Returns price identifier of the pool
   * @return identifier Price identifier
   */
  function getPriceFeedIdentifier()
    external
    view
    override
    returns (bytes32 identifier)
  {
    identifier = poolStorage.priceIdentifier;
  }
}
