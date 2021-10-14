// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  BaseControlledMintableBurnableERC20
} from '../../../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {ICreditLineController} from './interfaces/ICreditLineController.sol';
import {ICreditLineStorage} from './interfaces/ICreditLineStorage.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {SynthereumCreditLineLib} from './CreditLineLib.sol';
import {SynthereumCreditLine} from './CreditLine.sol';
import {Lockable} from '@uma/core/contracts/common/implementation/Lockable.sol';

/**
 * @title Self-Minting Perpetual Contract creator.
 * @notice Factory contract to create and register new instances of self-minting perpetual contracts.
 * Responsible for constraining the parameters used to construct a new self-minting perpetual. This creator contains a number of constraints
 * that are applied to newly created  contracts. These constraints can evolve over time and are
 * initially constrained to conservative values in this first iteration. Technically there is nothing in the
 * Perpetual contract requiring these constraints. However, because `createPerpetual()` is intended
 * to be the only way to create valid financial contracts that are registered with the DVM (via _registerContract),
  we can enforce deployment configurations here.
 */
contract SynthereumCreditLineCreator is Lockable {
  using FixedPoint for FixedPoint.Unsigned;

  struct Params {
    address collateralAddress;
    bytes32 priceFeedIdentifier;
    string syntheticName;
    string syntheticSymbol;
    address syntheticToken;
    ICreditLineStorage.Fee fee;
    ICreditLineStorage.Roles roles;
    uint256 liquidationPercentage;
    uint256 capMintAmount;
    uint256 overCollateralization;
    FixedPoint.Unsigned minSponsorTokens;
    address excessTokenBeneficiary;
    uint8 version;
  }

  // Address of Synthereum Finder
  ISynthereumFinder public synthereumFinder;

  //----------------------------------------
  // Events
  //----------------------------------------
  event CreatedPerpetual(
    address indexed perpetualAddress,
    address indexed deployerAddress
  );

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs the Perpetual contract.
   * @param _synthereumFinder Synthereum Finder address used to discover other contracts
   */
  constructor(address _synthereumFinder) nonReentrant() {
    synthereumFinder = ISynthereumFinder(_synthereumFinder);
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Creates an instance of perpetual and registers it within the registry.
   * @param params is a `ConstructorParams` object from Perpetual.
   * @return address of the deployed contract.
   */
  function createPerpetual(Params calldata params)
    public
    virtual
    nonReentrant()
    returns (address)
  {
    // Create a new synthetic token using the params.
    require(bytes(params.syntheticName).length != 0, 'Missing synthetic name');
    require(
      bytes(params.syntheticSymbol).length != 0,
      'Missing synthetic symbol'
    );
    require(
      params.syntheticToken != address(0),
      'Synthetic token address cannot be 0x00'
    );
    address derivative;
    // If the collateral token does not have a `decimals()` method,
    // then a default precision of 18 will be applied to the newly created synthetic token.
    BaseControlledMintableBurnableERC20 tokenCurrency =
      BaseControlledMintableBurnableERC20(params.syntheticToken);
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

    derivative = address(
      new SynthereumCreditLine(_convertParams(params), params.roles)
    );

    _setControllerValues(
      derivative,
      params.fee,
      params.liquidationPercentage,
      params.capMintAmount,
      params.overCollateralization
    );

    emit CreatedPerpetual(address(derivative), msg.sender);

    return address(derivative);
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------

  // Converts createPerpetual params to Perpetual constructor params.
  function _convertParams(Params calldata params)
    internal
    view
    returns (
      SynthereumCreditLine.PositionManagerParams memory constructorParams
    )
  {
    // Known from creator deployment.

    constructorParams.synthereumFinder = synthereumFinder;

    // Enforce configuration constraints.
    require(
      params.excessTokenBeneficiary != address(0),
      'Token Beneficiary cannot be 0x00'
    );

    // Input from function call.
    constructorParams.tokenAddress = params.syntheticToken;
    constructorParams.collateralAddress = params.collateralAddress;
    constructorParams.priceFeedIdentifier = params.priceFeedIdentifier;
    constructorParams.minSponsorTokens = params.minSponsorTokens;
    constructorParams.excessTokenBeneficiary = params.excessTokenBeneficiary;
    constructorParams.version = params.version;
  }

  /** @notice Sets the controller values for a self-minting derivative
   * @param derivative Address of the derivative to set controller values
   * @param feeStruct The fee config params
   * @param capMintAmount Cap on mint amount. How much synthetic tokens can be minted through a self-minting derivative.
   * This value is updatable
   */
  function _setControllerValues(
    address derivative,
    ICreditLineStorage.Fee memory feeStruct,
    uint256 liquidationRewardPercentage,
    uint256 capMintAmount,
    uint256 overCollateralization
  ) internal {
    ICreditLineController creditLineController =
      ICreditLineController(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.CreditLineController
        )
      );

    // prepare function calls args
    address[] memory derivatives = new address[](1);
    derivatives[0] = derivative;

    uint256[] memory capMintAmounts = new uint256[](1);
    capMintAmounts[0] = capMintAmount;

    uint256[] memory overCollateralizations = new uint256[](1);
    overCollateralizations[0] = overCollateralization;

    FixedPoint.Unsigned[] memory feePercentages = new FixedPoint.Unsigned[](1);
    feePercentages[0] = feeStruct.feePercentage;

    FixedPoint.Unsigned[] memory liqPercentages = new FixedPoint.Unsigned[](1);
    liqPercentages[0] = FixedPoint.Unsigned(liquidationRewardPercentage);

    address[][] memory feeRecipients = new address[][](1);
    feeRecipients[0] = feeStruct.feeRecipients;

    uint32[][] memory feeProportions = new uint32[][](1);
    feeProportions[0] = feeStruct.feeProportions;

    // set the derivative over collateralization percentage
    creditLineController.setOvercollateralization(
      derivatives,
      overCollateralizations
    );

    // set the derivative fee configuration
    creditLineController.setFeePercentage(derivatives, feePercentages);
    creditLineController.setFeeRecipients(
      derivatives,
      feeRecipients,
      feeProportions
    );

    // set the derivative cap mint amount
    creditLineController.setCapMintAmount(derivatives, capMintAmounts);

    // set the derivative liquidation reward percentage
    creditLineController.setLiquidationRewardPercentage(
      derivatives,
      liqPercentages
    );
  }
}
