// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {
  MintableBurnableIERC20
} from '../../common/interfaces/MintableBurnableIERC20.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  FinderInterface
} from '../../../../@jarvis-network/uma-core/contracts/oracle/interfaces/FinderInterface.sol';
import {
  IdentifierWhitelistInterface
} from '../../../../@jarvis-network/uma-core/contracts/oracle/interfaces/IdentifierWhitelistInterface.sol';
import {
  OracleInterfaces
} from '../../../../@jarvis-network/uma-core/contracts/oracle/implementation/Constants.sol';
import {
  FixedPoint
} from '../../../../@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {
  SelfMintingPerpetualMultiPartyLib
} from './SelfMintingPerpetualMultiPartyLib.sol';
import {
  SelfMintingPerpetualMultiParty
} from './SelfMintingPerpetualMultiParty.sol';
import {
  ContractCreator
} from '../../../../@jarvis-network/uma-core/contracts/oracle/implementation/ContractCreator.sol';
import {
  Testable
} from '../../../../@jarvis-network/uma-core/contracts/common/implementation/Testable.sol';
import {
  Lockable
} from '../../../../@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';

contract SelfMintingPerpetutalMultiPartyCreator is
  ContractCreator,
  Testable,
  Lockable
{
  using FixedPoint for FixedPoint.Unsigned;

  struct Params {
    address collateralAddress;
    bytes32 priceFeedIdentifier;
    string syntheticName;
    string syntheticSymbol;
    address syntheticToken;
    FixedPoint.Unsigned collateralRequirement;
    FixedPoint.Unsigned disputeBondPct;
    FixedPoint.Unsigned sponsorDisputeRewardPct;
    FixedPoint.Unsigned disputerDisputeRewardPct;
    FixedPoint.Unsigned minSponsorTokens;
    uint256 withdrawalLiveness;
    uint256 liquidationLiveness;
    address excessTokenBeneficiary;
    uint8 version;
    SelfMintingPerpetualMultiParty.DaoFee daoFee;
    FixedPoint.Unsigned capMintAmount;
    FixedPoint.Unsigned capDepositRatio;
  }

  ISynthereumFinder public synthereumFinder;

  event CreatedPerpetual(
    address indexed perpetualAddress,
    address indexed deployerAddress
  );

  constructor(
    address _umaFinderAddress,
    address _synthereumFinder,
    address _timerAddress
  )
    public
    ContractCreator(_umaFinderAddress)
    Testable(_timerAddress)
    nonReentrant()
  {
    synthereumFinder = ISynthereumFinder(_synthereumFinder);
  }

  function createPerpetual(Params memory params)
    public
    virtual
    nonReentrant()
    returns (address)
  {
    require(bytes(params.syntheticName).length != 0, 'Missing synthetic name');
    require(
      bytes(params.syntheticSymbol).length != 0,
      'Missing synthetic symbol'
    );
    require(
      params.syntheticToken != address(0),
      'Synthetic token address cannot be 0x0'
    );
    address derivative;
    MintableBurnableIERC20 tokenCurrency =
      MintableBurnableIERC20(params.syntheticToken);
    require(
      keccak256(abi.encodePacked(tokenCurrency.name())) ==
        keccak256(abi.encodePacked(params.syntheticName)),
      'Wrong synthetic token name'
    );
    require(
      keccak256(abi.encodePacked(tokenCurrency.symbol())) ==
        keccak256(abi.encodePacked(params.syntheticSymbol)),
      'Wrong synthetic token symbol'
    );
    require(
      tokenCurrency.decimals() == uint8(18),
      'Decimals of synthetic token must be 18'
    );
    derivative = SelfMintingPerpetualMultiPartyLib.deploy(
      _convertParams(params)
    );

    _registerContract(new address[](0), address(derivative));

    emit CreatedPerpetual(address(derivative), msg.sender);

    return address(derivative);
  }

  function _convertParams(Params memory params)
    private
    view
    returns (
      SelfMintingPerpetualMultiParty.ConstructorParams memory constructorParams
    )
  {
    constructorParams.positionManagerParams.finderAddress = finderAddress;
    constructorParams.positionManagerParams.synthereumFinder = synthereumFinder;
    constructorParams.positionManagerParams.timerAddress = timerAddress;

    require(params.withdrawalLiveness != 0, 'Withdrawal liveness cannot be 0');
    require(
      params.liquidationLiveness != 0,
      'Liquidation liveness cannot be 0'
    );
    require(
      params.excessTokenBeneficiary != address(0),
      'Token Beneficiary cannot be 0x0'
    );
    require(
      params.daoFee.feeRecipient != address(0),
      'Fee recipient cannot be 0x0'
    );
    require(
      params.withdrawalLiveness < 5200 weeks,
      'Withdrawal liveness too large'
    );
    require(
      params.liquidationLiveness < 5200 weeks,
      'Liquidation liveness too large'
    );

    constructorParams.positionManagerParams.tokenAddress = params
      .syntheticToken;
    constructorParams.positionManagerParams.collateralAddress = params
      .collateralAddress;
    constructorParams.positionManagerParams.priceFeedIdentifier = params
      .priceFeedIdentifier;
    constructorParams.liquidatableParams.collateralRequirement = params
      .collateralRequirement;
    constructorParams.liquidatableParams.disputeBondPct = params.disputeBondPct;
    constructorParams.liquidatableParams.sponsorDisputeRewardPct = params
      .sponsorDisputeRewardPct;
    constructorParams.liquidatableParams.disputerDisputeRewardPct = params
      .disputerDisputeRewardPct;
    constructorParams.positionManagerParams.minSponsorTokens = params
      .minSponsorTokens;
    constructorParams.positionManagerParams.withdrawalLiveness = params
      .withdrawalLiveness;
    constructorParams.liquidatableParams.liquidationLiveness = params
      .liquidationLiveness;
    constructorParams.positionManagerParams.excessTokenBeneficiary = params
      .excessTokenBeneficiary;
    constructorParams.positionManagerParams.version = params.version;
    constructorParams.positionManagerParams.daoFee = params.daoFee;
    constructorParams.positionManagerParams.capMintAmount = params
      .capMintAmount;
    constructorParams.positionManagerParams.capDepositRatio = params
      .capDepositRatio;
  }
}
