// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {
  MintableBurnableIERC20
} from '../common/interfaces/MintableBurnableIERC20.sol';
import {
  IDerivativeDeployment
} from '../common/interfaces/IDerivativeDeployment.sol';
import {IDerivativeMain} from '../common/interfaces/IDerivativeMain.sol';
import {
  OracleInterface
} from '@jarvis-network/uma-core/contracts/oracle/interfaces/OracleInterface.sol';
import {
  IdentifierWhitelistInterface
} from '@jarvis-network/uma-core/contracts/oracle/interfaces/IdentifierWhitelistInterface.sol';
import {
  AdministrateeInterface
} from '@jarvis-network/uma-core/contracts/oracle/interfaces/AdministrateeInterface.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {IDerivative} from '../common/interfaces/IDerivative.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  OracleInterfaces
} from '@jarvis-network/uma-core/contracts/oracle/implementation/Constants.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {
  FixedPoint
} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {
  PerpetualPositionManagerPoolPartyLib
} from './PerpetualPositionManagerPoolPartyLib.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {
  AddressWhitelist
} from '@jarvis-network/uma-core/contracts/common/implementation/AddressWhitelist.sol';
import {FeePayerParty} from '../common/FeePayerParty.sol';

contract PerpetualPositionManagerPoolParty is
  IDerivative,
  AccessControl,
  FeePayerParty
{
  using FixedPoint for FixedPoint.Unsigned;
  using SafeERC20 for IERC20;
  using SafeERC20 for MintableBurnableIERC20;
  using PerpetualPositionManagerPoolPartyLib for PositionData;
  using PerpetualPositionManagerPoolPartyLib for PositionManagerData;

  bytes32 public constant POOL_ROLE = keccak256('Pool');

  struct PositionManagerParams {
    uint256 withdrawalLiveness;
    address collateralAddress;
    address tokenAddress;
    address finderAddress;
    bytes32 priceFeedIdentifier;
    FixedPoint.Unsigned minSponsorTokens;
    address timerAddress;
    address excessTokenBeneficiary;
    ISynthereumFinder synthereumFinder;
  }

  struct Roles {
    address[] admins;
    address[] pools;
  }

  struct PositionData {
    FixedPoint.Unsigned tokensOutstanding;
    uint256 withdrawalRequestPassTimestamp;
    FixedPoint.Unsigned withdrawalRequestAmount;
    FixedPoint.Unsigned rawCollateral;
  }

  struct GlobalPositionData {
    FixedPoint.Unsigned totalTokensOutstanding;
    FixedPoint.Unsigned rawTotalPositionCollateral;
  }

  struct PositionManagerData {
    ISynthereumFinder synthereumFinder;
    MintableBurnableIERC20 tokenCurrency;
    bytes32 priceIdentifier;
    uint256 withdrawalLiveness;
    FixedPoint.Unsigned minSponsorTokens;
    FixedPoint.Unsigned emergencyShutdownPrice;
    uint256 emergencyShutdownTimestamp;
    address excessTokenBeneficiary;
  }

  mapping(address => PositionData) public positions;

  GlobalPositionData public globalPositionData;

  PositionManagerData public positionManagerData;

  event Deposit(address indexed sponsor, uint256 indexed collateralAmount);
  event Withdrawal(address indexed sponsor, uint256 indexed collateralAmount);
  event RequestWithdrawal(
    address indexed sponsor,
    uint256 indexed collateralAmount
  );
  event RequestWithdrawalExecuted(
    address indexed sponsor,
    uint256 indexed collateralAmount
  );
  event RequestWithdrawalCanceled(
    address indexed sponsor,
    uint256 indexed collateralAmount
  );
  event PositionCreated(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount
  );
  event NewSponsor(address indexed sponsor);
  event EndedSponsorPosition(address indexed sponsor);
  event Redeem(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount
  );
  event Repay(
    address indexed sponsor,
    uint256 indexed numTokensRepaid,
    uint256 indexed newTokenCount
  );
  event EmergencyShutdown(address indexed caller, uint256 shutdownTimestamp);
  event SettleEmergencyShutdown(
    address indexed caller,
    uint256 indexed collateralReturned,
    uint256 indexed tokensBurned
  );

  modifier onlyPool() {
    require(hasRole(POOL_ROLE, msg.sender), 'Sender must be a pool');
    _;
  }

  modifier onlyCollateralizedPosition(address sponsor) {
    _onlyCollateralizedPosition(sponsor);
    _;
  }

  modifier notEmergencyShutdown() {
    _notEmergencyShutdown();
    _;
  }

  modifier isEmergencyShutdown() {
    _isEmergencyShutdown();
    _;
  }

  modifier noPendingWithdrawal(address sponsor) {
    _positionHasNoPendingWithdrawal(sponsor);
    _;
  }

  constructor(
    PositionManagerParams memory _positionManagerData,
    Roles memory _roles
  )
    public
    FeePayerParty(
      _positionManagerData.collateralAddress,
      _positionManagerData.finderAddress,
      _positionManagerData.timerAddress
    )
    nonReentrant()
  {
    require(
      _getIdentifierWhitelist().isIdentifierSupported(
        _positionManagerData.priceFeedIdentifier
      ),
      'Unsupported price identifier'
    );
    require(
      _getCollateralWhitelist().isOnWhitelist(
        _positionManagerData.collateralAddress
      ),
      'Collateral not whitelisted'
    );
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(POOL_ROLE, DEFAULT_ADMIN_ROLE);
    for (uint256 j = 0; j < _roles.admins.length; j++) {
      _setupRole(DEFAULT_ADMIN_ROLE, _roles.admins[j]);
    }
    for (uint256 j = 0; j < _roles.pools.length; j++) {
      _setupRole(POOL_ROLE, _roles.pools[j]);
    }
    positionManagerData.synthereumFinder = _positionManagerData
      .synthereumFinder;
    positionManagerData.withdrawalLiveness = _positionManagerData
      .withdrawalLiveness;
    positionManagerData.tokenCurrency = MintableBurnableIERC20(
      _positionManagerData.tokenAddress
    );
    positionManagerData.minSponsorTokens = _positionManagerData
      .minSponsorTokens;
    positionManagerData.priceIdentifier = _positionManagerData
      .priceFeedIdentifier;
    positionManagerData.excessTokenBeneficiary = _positionManagerData
      .excessTokenBeneficiary;
  }

  function deposit(FixedPoint.Unsigned memory collateralAmount)
    external
    override
  {
    depositTo(msg.sender, collateralAmount);
  }

  function withdraw(FixedPoint.Unsigned memory collateralAmount)
    external
    override
    onlyPool()
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
    returns (FixedPoint.Unsigned memory amountWithdrawn)
  {
    PositionData storage positionData = _getPositionData(msg.sender);

    amountWithdrawn = positionData.withdraw(
      globalPositionData,
      collateralAmount,
      feePayerData
    );
  }

  function requestWithdrawal(FixedPoint.Unsigned memory collateralAmount)
    external
    override
    onlyPool()
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    nonReentrant()
  {
    uint256 actualTime = getCurrentTime();
    PositionData storage positionData = _getPositionData(msg.sender);
    positionData.requestWithdrawal(
      positionManagerData,
      collateralAmount,
      actualTime,
      feePayerData
    );
  }

  function withdrawPassedRequest()
    external
    override
    onlyPool()
    notEmergencyShutdown()
    fees()
    nonReentrant()
    returns (FixedPoint.Unsigned memory amountWithdrawn)
  {
    uint256 actualTime = getCurrentTime();
    PositionData storage positionData = _getPositionData(msg.sender);
    amountWithdrawn = positionData.withdrawPassedRequest(
      globalPositionData,
      actualTime,
      feePayerData
    );
  }

  function cancelWithdrawal()
    external
    override
    onlyPool()
    notEmergencyShutdown()
    nonReentrant()
  {
    PositionData storage positionData = _getPositionData(msg.sender);
    positionData.cancelWithdrawal();
  }

  function create(
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) external override onlyPool() notEmergencyShutdown() fees() nonReentrant() {
    PositionData storage positionData = positions[msg.sender];

    positionData.create(
      globalPositionData,
      positionManagerData,
      collateralAmount,
      numTokens,
      feePayerData
    );
  }

  function redeem(FixedPoint.Unsigned memory numTokens)
    external
    override
    onlyPool()
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
    returns (FixedPoint.Unsigned memory amountWithdrawn)
  {
    PositionData storage positionData = _getPositionData(msg.sender);

    amountWithdrawn = positionData.redeeem(
      globalPositionData,
      positionManagerData,
      numTokens,
      feePayerData,
      msg.sender
    );
  }

  function repay(FixedPoint.Unsigned memory numTokens)
    external
    override
    onlyPool()
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
  {
    PositionData storage positionData = _getPositionData(msg.sender);
    positionData.repay(globalPositionData, positionManagerData, numTokens);
  }

  function settleEmergencyShutdown()
    external
    override
    onlyPool()
    isEmergencyShutdown()
    fees()
    nonReentrant()
    returns (FixedPoint.Unsigned memory amountWithdrawn)
  {
    PositionData storage positionData = positions[msg.sender];
    amountWithdrawn = positionData.settleEmergencyShutdown(
      globalPositionData,
      positionManagerData,
      feePayerData
    );
  }

  function emergencyShutdown()
    external
    override(IDerivativeMain, AdministrateeInterface)
    notEmergencyShutdown()
    nonReentrant()
  {
    require(
      msg.sender ==
        positionManagerData.synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.Manager
        ) ||
        msg.sender == _getFinancialContractsAdminAddress(),
      'Caller must be a Synthereum manager or the UMA governor'
    );
    positionManagerData.emergencyShutdownTimestamp = getCurrentTime();
    positionManagerData.requestOraclePrice(
      positionManagerData.emergencyShutdownTimestamp,
      feePayerData
    );
    emit EmergencyShutdown(
      msg.sender,
      positionManagerData.emergencyShutdownTimestamp
    );
  }

  function remargin()
    external
    override(IDerivativeMain, AdministrateeInterface)
  {
    return;
  }

  function trimExcess(IERC20 token)
    external
    override
    nonReentrant()
    returns (FixedPoint.Unsigned memory amount)
  {
    FixedPoint.Unsigned memory pfcAmount = _pfc();
    amount = positionManagerData.trimExcess(token, pfcAmount, feePayerData);
  }

  function deleteSponsorPosition(address sponsor) external onlyThisContract {
    delete positions[sponsor];
  }

  function getCollateral(address sponsor)
    external
    view
    override
    nonReentrantView()
    returns (FixedPoint.Unsigned memory collateralAmount)
  {
    collateralAmount = positions[sponsor]
      .rawCollateral
      .getFeeAdjustedCollateral(feePayerData.cumulativeFeeMultiplier);
  }

  function synthereumFinder()
    external
    view
    override
    returns (ISynthereumFinder finder)
  {
    finder = positionManagerData.synthereumFinder;
  }

  /**
   * @notice Get emergency shutdown price
   * @return token Synthetic token
   */
  function tokenCurrency() external view override returns (IERC20 token) {
    token = positionManagerData.tokenCurrency;
  }

  function syntheticTokenSymbol()
    external
    view
    override
    returns (string memory symbol)
  {
    symbol = IStandardERC20(address(positionManagerData.tokenCurrency))
      .symbol();
  }

  function priceIdentifier()
    external
    view
    override
    returns (bytes32 identifier)
  {
    identifier = positionManagerData.priceIdentifier;
  }

  function totalPositionCollateral()
    external
    view
    override
    nonReentrantView()
    returns (FixedPoint.Unsigned memory totalCollateral)
  {
    totalCollateral = globalPositionData
      .rawTotalPositionCollateral
      .getFeeAdjustedCollateral(feePayerData.cumulativeFeeMultiplier);
  }

  function totalTokensOutstanding()
    external
    view
    override
    returns (FixedPoint.Unsigned memory totalTokens)
  {
    totalTokens = globalPositionData.totalTokensOutstanding;
  }

  function emergencyShutdownPrice()
    external
    view
    override
    isEmergencyShutdown()
    returns (FixedPoint.Unsigned memory)
  {
    return positionManagerData.emergencyShutdownPrice;
  }

  function getAdminMembers() external view override returns (address[] memory) {
    uint256 numberOfMembers = getRoleMemberCount(DEFAULT_ADMIN_ROLE);
    address[] memory members = new address[](numberOfMembers);
    for (uint256 j = 0; j < numberOfMembers; j++) {
      address newMember = getRoleMember(DEFAULT_ADMIN_ROLE, j);
      members[j] = newMember;
    }
    return members;
  }

  function getPoolMembers() external view override returns (address[] memory) {
    uint256 numberOfMembers = getRoleMemberCount(POOL_ROLE);
    address[] memory members = new address[](numberOfMembers);
    for (uint256 j = 0; j < numberOfMembers; j++) {
      address newMember = getRoleMember(POOL_ROLE, j);
      members[j] = newMember;
    }
    return members;
  }

  function depositTo(
    address sponsor,
    FixedPoint.Unsigned memory collateralAmount
  )
    public
    override
    onlyPool()
    notEmergencyShutdown()
    noPendingWithdrawal(sponsor)
    fees()
    nonReentrant()
  {
    PositionData storage positionData = _getPositionData(sponsor);

    positionData.depositTo(
      globalPositionData,
      collateralAmount,
      feePayerData,
      sponsor
    );
  }

  function collateralCurrency()
    public
    view
    override(IDerivativeDeployment, FeePayerParty)
    returns (IERC20 collateral)
  {
    collateral = FeePayerParty.collateralCurrency();
  }

  function _pfc()
    internal
    view
    virtual
    override
    returns (FixedPoint.Unsigned memory)
  {
    return
      globalPositionData.rawTotalPositionCollateral.getFeeAdjustedCollateral(
        feePayerData.cumulativeFeeMultiplier
      );
  }

  function _getPositionData(address sponsor)
    internal
    view
    onlyCollateralizedPosition(sponsor)
    returns (PositionData storage)
  {
    return positions[sponsor];
  }

  function _getIdentifierWhitelist()
    internal
    view
    returns (IdentifierWhitelistInterface)
  {
    return
      IdentifierWhitelistInterface(
        feePayerData.finder.getImplementationAddress(
          OracleInterfaces.IdentifierWhitelist
        )
      );
  }

  function _getCollateralWhitelist() internal view returns (AddressWhitelist) {
    return
      AddressWhitelist(
        feePayerData.finder.getImplementationAddress(
          OracleInterfaces.CollateralWhitelist
        )
      );
  }

  function _onlyCollateralizedPosition(address sponsor) internal view {
    require(
      positions[sponsor]
        .rawCollateral
        .getFeeAdjustedCollateral(feePayerData.cumulativeFeeMultiplier)
        .isGreaterThan(0),
      'Position has no collateral'
    );
  }

  function _notEmergencyShutdown() internal view {
    require(
      positionManagerData.emergencyShutdownTimestamp == 0,
      'Contract emergency shutdown'
    );
  }

  function _isEmergencyShutdown() internal view {
    require(
      positionManagerData.emergencyShutdownTimestamp != 0,
      'Contract not emergency shutdown'
    );
  }

  function _positionHasNoPendingWithdrawal(address sponsor) internal view {
    require(
      _getPositionData(sponsor).withdrawalRequestPassTimestamp == 0,
      'Pending withdrawal'
    );
  }

  function _getFinancialContractsAdminAddress()
    internal
    view
    returns (address)
  {
    return
      feePayerData.finder.getImplementationAddress(
        OracleInterfaces.FinancialContractsAdmin
      );
  }
}
