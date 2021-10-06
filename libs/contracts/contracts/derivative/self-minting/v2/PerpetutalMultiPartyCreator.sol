// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  BaseControlledMintableBurnableERC20
} from '../../../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  ISelfMintingController
} from '../common/interfaces/ISelfMintingController.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {
  FinderInterface
} from '@uma/core/contracts/oracle/interfaces/FinderInterface.sol';
import {
  IdentifierWhitelistInterface
} from '@uma/core/contracts/oracle/interfaces/IdentifierWhitelistInterface.sol';
import {
  OracleInterfaces
} from '@uma/core/contracts/oracle/implementation/Constants.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {PerpetualMultiPartyLib} from './PerpetualMultiPartyLib.sol';
import {PerpetualMultiParty} from './PerpetualMultiParty.sol';
import {Testable} from '@uma/core/contracts/common/implementation/Testable.sol';
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
contract PerpetutalMultiPartyCreator is Testable, Lockable {
  using FixedPoint for FixedPoint.Unsigned;

  struct Params {
    address collateralAddress;
    bytes32 priceFeedIdentifier;
    string syntheticName;
    string syntheticSymbol;
    address syntheticToken;
    FixedPoint.Unsigned overCollateralization;
    FixedPoint.Unsigned liquidatorRewardPct;
    FixedPoint.Unsigned minSponsorTokens;
    address excessTokenBeneficiary;
    uint8 version;
    ISelfMintingController.DaoFee daoFee;
    uint256 capMintAmount;
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
   * @param _timerAddress Contract that stores the current time in a testing environment.
   */
  constructor(address _synthereumFinder, address _timerAddress)
    Testable(_timerAddress)
    nonReentrant()
  {
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
    derivative = PerpetualMultiPartyLib.deploy(_convertParams(params));

    _setControllerValues(derivative, params.daoFee, params.capMintAmount);

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
    returns (PerpetualMultiParty.ConstructorParams memory constructorParams)
  {
    // Known from creator deployment.

    constructorParams.positionManagerParams.synthereumFinder = synthereumFinder;
    constructorParams.positionManagerParams.timerAddress = timerAddress;

    // Enforce configuration constraints.
    require(
      params.excessTokenBeneficiary != address(0),
      'Token Beneficiary cannot be 0x00'
    );
    require(
      params.daoFee.feeRecipient != address(0),
      'Fee recipient cannot be 0x00'
    );

    // Input from function call.
    constructorParams.positionManagerParams.tokenAddress = params
      .syntheticToken;
    constructorParams.positionManagerParams.collateralAddress = params
      .collateralAddress;
    constructorParams.positionManagerParams.priceFeedIdentifier = params
      .priceFeedIdentifier;
    constructorParams.positionManagerParams.overCollateralization = params
      .overCollateralization;
    constructorParams.positionManagerParams.liquidatorRewardPct = params
      .liquidatorRewardPct;
    constructorParams.positionManagerParams.minSponsorTokens = params
      .minSponsorTokens;
    constructorParams.positionManagerParams.excessTokenBeneficiary = params
      .excessTokenBeneficiary;
    constructorParams.positionManagerParams.version = params.version;
  }

  /** @notice Sets the controller values for a self-minting derivative
   * @param derivative Address of the derivative to set controller values
   * @param daoFee The DAO fee that will be paid when interacting with the self-minting derivative
   * @param capMintAmount Cap on mint amount. How much synthetic tokens can be minted through a self-minting derivative.
   * This value is updatable
   */
  function _setControllerValues(
    address derivative,
    ISelfMintingController.DaoFee calldata daoFee,
    uint256 capMintAmount
  ) internal {
    ISelfMintingController selfMintingController =
      ISelfMintingController(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.SelfMintingController
        )
      );
    address[] memory inputAddress = new address[](1);
    inputAddress[0] = derivative;
    ISelfMintingController.DaoFee[] memory inuptFee =
      new ISelfMintingController.DaoFee[](1);
    inuptFee[0] = daoFee;
    uint256[] memory inputCapMint = new uint256[](1);
    inputCapMint[0] = capMintAmount;
    selfMintingController.setDaoFee(inputAddress, inuptFee);
    selfMintingController.setCapMintAmount(inputAddress, inputCapMint);
  }
}
