// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  IDeploymentSignature
} from '../../../core/interfaces/IDeploymentSignature.sol';
import {
  ISynthereumCollateralWhitelist
} from '../../../core/interfaces/ICollateralWhitelist.sol';
import {
  ISynthereumIdentifierWhitelist
} from '../../../core/interfaces/IIdentifierWhitelist.sol';
import {SynthereumInterfaces} from '../../../core/Constants.sol';
import {CreditLineCreator} from './CreditLineCreator.sol';
import {CreditLine} from './CreditLine.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

/** @title Contract factory of self-minting derivatives
 */
contract CreditLineFactory is
  IDeploymentSignature,
  ReentrancyGuard,
  CreditLineCreator
{
  //----------------------------------------
  // Storage
  //----------------------------------------

  bytes4 public override deploymentSignature;

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs the CreditLineFactory contract
   * @param _synthereumFinder Synthereum Finder address used to discover other contracts
   */
  constructor(address _synthereumFinder) CreditLineCreator(_synthereumFinder) {
    deploymentSignature = this.createSelfMintingDerivative.selector;
  }

  /**
   * @notice Check if the sender is the deployer and deploy a new creditLine contract
   * @param params is a `ConstructorParams` object from creditLine.
   * @return creditLine address of the deployed contract.
   */
  function createSelfMintingDerivative(Params calldata params)
    public
    override
    nonReentrant
    returns (CreditLine creditLine)
  {
    ISynthereumFinder _synthereumFinder = ISynthereumFinder(synthereumFinder);
    address deployer =
      _synthereumFinder.getImplementationAddress(SynthereumInterfaces.Deployer);
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    ISynthereumCollateralWhitelist collateralWhitelist =
      ISynthereumCollateralWhitelist(
        _synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.CollateralWhitelist
        )
      );
    require(
      collateralWhitelist.isOnWhitelist(address(params.collateralToken)),
      'Collateral not supported'
    );
    ISynthereumIdentifierWhitelist identifierWhitelist =
      ISynthereumIdentifierWhitelist(
        _synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.IdentifierWhitelist
        )
      );
    require(
      identifierWhitelist.isOnWhitelist(params.priceFeedIdentifier),
      'Identifier not supported'
    );
    creditLine = super.createSelfMintingDerivative(params);
  }
}
