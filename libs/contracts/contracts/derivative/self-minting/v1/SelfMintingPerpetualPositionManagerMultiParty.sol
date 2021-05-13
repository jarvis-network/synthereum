// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IStandardERC20} from '../../../base/interfaces/IStandardERC20.sol';
import {
  MintableBurnableIERC20
} from '../../common/interfaces/MintableBurnableIERC20.sol';
import {
  IdentifierWhitelistInterface
} from '@jarvis-network/uma-core/contracts/oracle/interfaces/IdentifierWhitelistInterface.sol';
import {
  AddressWhitelist
} from '@jarvis-network/uma-core/contracts/common/implementation/AddressWhitelist.sol';
import {
  AdministrateeInterface
} from '@jarvis-network/uma-core/contracts/oracle/interfaces/AdministrateeInterface.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  ISelfMintingDerivativeDeployment
} from '../common/interfaces/ISelfMintingDerivativeDeployment.sol';
import {
  OracleInterface
} from '@jarvis-network/uma-core/contracts/oracle/interfaces/OracleInterface.sol';
import {
  OracleInterfaces
} from '@jarvis-network/uma-core/contracts/oracle/implementation/Constants.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {
  FixedPoint
} from '@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {
  SelfMintingPerpetualPositionManagerMultiPartyLib
} from './SelfMintingPerpetualPositionManagerMultiPartyLib.sol';
import {FeePayerParty} from '../../common/FeePayerParty.sol';

contract SelfMintingPerpetualPositionManagerMultiParty is
  ISelfMintingDerivativeDeployment,
  FeePayerParty
{
  using FixedPoint for FixedPoint.Unsigned;
  using SafeERC20 for IERC20;
  using SafeERC20 for MintableBurnableIERC20;
  using SelfMintingPerpetualPositionManagerMultiPartyLib for PositionData;
  using SelfMintingPerpetualPositionManagerMultiPartyLib for PositionManagerData;

  struct PositionManagerParams {
    uint256 withdrawalLiveness;
    address collateralAddress;
    address tokenAddress;
    address finderAddress;
    bytes32 priceFeedIdentifier;
    FixedPoint.Unsigned minSponsorTokens;
    address timerAddress;
    address excessTokenBeneficiary;
    uint8 version;
    ISynthereumFinder synthereumFinder;
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
    uint8 version;
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
    uint256 indexed tokenAmount,
    uint256 feeAmount
  );
  event NewSponsor(address indexed sponsor);
  event EndedSponsorPosition(address indexed sponsor);
  event Redeem(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount,
    uint256 feeAmount
  );
  event Repay(
    address indexed sponsor,
    uint256 indexed numTokensRepaid,
    uint256 indexed newTokenCount,
    uint256 feeAmount
  );
  event EmergencyShutdown(address indexed caller, uint256 shutdownTimestamp);
  event SettleEmergencyShutdown(
    address indexed caller,
    uint256 indexed collateralReturned,
    uint256 indexed tokensBurned
  );

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

  constructor(PositionManagerParams memory _positionManagerData)
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
    positionManagerData.version = _positionManagerData.version;
  }

  function deposit(uint256 collateralAmount) external {
    depositTo(msg.sender, collateralAmount);
  }

  function withdraw(uint256 collateralAmount)
    external
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
    returns (uint256 amountWithdrawn)
  {
    PositionData storage positionData = _getPositionData(msg.sender);

    amountWithdrawn = positionData
      .withdraw(
      globalPositionData,
      FixedPoint.Unsigned(collateralAmount),
      feePayerData
    )
      .rawValue;
  }

  function requestWithdrawal(uint256 collateralAmount)
    external
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    nonReentrant()
  {
    uint256 actualTime = getCurrentTime();
    PositionData storage positionData = _getPositionData(msg.sender);
    positionData.requestWithdrawal(
      positionManagerData,
      FixedPoint.Unsigned(collateralAmount),
      actualTime,
      feePayerData
    );
  }

  function withdrawPassedRequest()
    external
    notEmergencyShutdown()
    fees()
    nonReentrant()
    returns (uint256 amountWithdrawn)
  {
    uint256 actualTime = getCurrentTime();
    PositionData storage positionData = _getPositionData(msg.sender);
    amountWithdrawn = positionData
      .withdrawPassedRequest(globalPositionData, actualTime, feePayerData)
      .rawValue;
  }

  function cancelWithdrawal() external notEmergencyShutdown() nonReentrant() {
    PositionData storage positionData = _getPositionData(msg.sender);
    positionData.cancelWithdrawal();
  }

  function create(
    uint256 collateralAmount,
    uint256 numTokens,
    uint256 feePercentage
  )
    external
    notEmergencyShutdown()
    fees()
    nonReentrant()
    returns (uint256 daoFeeAmount)
  {
    PositionData storage positionData = positions[msg.sender];
    daoFeeAmount = positionData
      .create(
      globalPositionData,
      positionManagerData,
      FixedPoint.Unsigned(collateralAmount),
      FixedPoint.Unsigned(numTokens),
      FixedPoint.Unsigned(feePercentage),
      feePayerData
    )
      .rawValue;
  }

  function redeem(uint256 numTokens, uint256 feePercentage)
    external
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
    returns (uint256 amountWithdrawn, uint256 daoFeeAmount)
  {
    PositionData storage positionData = _getPositionData(msg.sender);

    (
      FixedPoint.Unsigned memory collateralAmount,
      FixedPoint.Unsigned memory feeAmount
    ) =
      positionData.redeeem(
        globalPositionData,
        positionManagerData,
        FixedPoint.Unsigned(numTokens),
        FixedPoint.Unsigned(feePercentage),
        feePayerData,
        msg.sender
      );

    amountWithdrawn = collateralAmount.rawValue;
    daoFeeAmount = feeAmount.rawValue;
  }

  function repay(uint256 numTokens, uint256 feePercentage)
    external
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
    returns (uint256 daoFeeAmount)
  {
    PositionData storage positionData = _getPositionData(msg.sender);
    daoFeeAmount = (
      positionData.repay(
        globalPositionData,
        positionManagerData,
        FixedPoint.Unsigned(numTokens),
        FixedPoint.Unsigned(feePercentage),
        feePayerData
      )
    )
      .rawValue;
  }

  function settleEmergencyShutdown()
    external
    isEmergencyShutdown()
    fees()
    nonReentrant()
    returns (uint256 amountWithdrawn)
  {
    PositionData storage positionData = positions[msg.sender];
    amountWithdrawn = positionData
      .settleEmergencyShutdown(
      globalPositionData,
      positionManagerData,
      feePayerData
    )
      .rawValue;
  }

  function emergencyShutdown()
    external
    override
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

  function remargin() external override {
    return;
  }

  function trimExcess(IERC20 token)
    external
    nonReentrant()
    returns (uint256 amount)
  {
    FixedPoint.Unsigned memory pfcAmount = _pfc();
    amount = positionManagerData
      .trimExcess(token, pfcAmount, feePayerData)
      .rawValue;
  }

  function deleteSponsorPosition(address sponsor) external onlyThisContract {
    delete positions[sponsor];
  }

  function getCollateral(address sponsor)
    external
    view
    nonReentrantView()
    returns (FixedPoint.Unsigned memory collateralAmount)
  {
    return
      positions[sponsor].rawCollateral.getFeeAdjustedCollateral(
        feePayerData.cumulativeFeeMultiplier
      );
  }

  function synthereumFinder()
    external
    view
    override
    returns (ISynthereumFinder finder)
  {
    finder = positionManagerData.synthereumFinder;
  }

  function tokenCurrency() external view override returns (IERC20 synthToken) {
    synthToken = positionManagerData.tokenCurrency;
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

  function version() external view override returns (uint8 contractVersion) {
    contractVersion = positionManagerData.version;
  }

  function priceIdentifier() external view returns (bytes32 identifier) {
    identifier = positionManagerData.priceIdentifier;
  }

  function totalPositionCollateral()
    external
    view
    nonReentrantView()
    returns (uint256)
  {
    return
      globalPositionData
        .rawTotalPositionCollateral
        .getFeeAdjustedCollateral(feePayerData.cumulativeFeeMultiplier)
        .rawValue;
  }

  function totalTokensOutstanding() external view returns (uint256) {
    return globalPositionData.totalTokensOutstanding.rawValue;
  }

  function emergencyShutdownPrice()
    external
    view
    isEmergencyShutdown()
    returns (uint256)
  {
    return positionManagerData.emergencyShutdownPrice.rawValue;
  }

  function calculateDaoFee(uint256 numTokens) external view returns (uint256) {
    return
      positionManagerData
        .calculateDaoFee(
        globalPositionData,
        FixedPoint.Unsigned(numTokens),
        feePayerData
      )
        .rawValue;
  }

  function daoFee()
    external
    view
    returns (uint256 feePercentage, address feeRecipient)
  {
    (FixedPoint.Unsigned memory percentage, address recipient) =
      positionManagerData.daoFee();
    feePercentage = percentage.rawValue;
    feeRecipient = recipient;
  }

  function capMintAmount() external view returns (uint256 capMint) {
    capMint = positionManagerData.capMintAmount().rawValue;
  }

  function capDepositRatio() external view returns (uint256 capDeposit) {
    capDeposit = positionManagerData.capDepositRatio().rawValue;
  }

  function depositTo(address sponsor, uint256 collateralAmount)
    public
    notEmergencyShutdown()
    noPendingWithdrawal(sponsor)
    fees()
    nonReentrant()
  {
    PositionData storage positionData = _getPositionData(sponsor);

    positionData.depositTo(
      globalPositionData,
      positionManagerData,
      FixedPoint.Unsigned(collateralAmount),
      feePayerData,
      sponsor
    );
  }

  function collateralCurrency()
    public
    view
    override(ISelfMintingDerivativeDeployment, FeePayerParty)
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
