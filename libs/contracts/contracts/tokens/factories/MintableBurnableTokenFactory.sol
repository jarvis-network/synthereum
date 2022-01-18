// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumFactoryVersioning
} from '../../core/interfaces/IFactoryVersioning.sol';
import {
  SynthereumInterfaces,
  FactoryInterfaces
} from '../../core/Constants.sol';
import {
  BaseControlledMintableBurnableERC20
} from '../interfaces/BaseControlledMintableBurnableERC20.sol';

/**
 * @title Factory for creating new mintable and burnable tokens.
 */
abstract contract MintableBurnableTokenFactory {
  //----------------------------------------
  // Storage
  //----------------------------------------

  ISynthereumFinder public synthereumFinder;

  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier onlyPoolFactoryOrFixedRateFactory() {
    ISynthereumFactoryVersioning factoryVersioning =
      ISynthereumFactoryVersioning(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.FactoryVersioning
        )
      );
    uint8 numberOfPoolFactories =
      factoryVersioning.numberOfFactoryVersions(FactoryInterfaces.PoolFactory);
    uint8 numberOfFixedRateFactories =
      factoryVersioning.numberOfFactoryVersions(
        FactoryInterfaces.FixedRateFactory
      );
    bool isPoolFactory =
      _checkSenderIsFactory(
        factoryVersioning,
        numberOfPoolFactories,
        FactoryInterfaces.PoolFactory
      );
    if (isPoolFactory) {
      _;
      return;
    }
    bool isFixedRateFactory =
      _checkSenderIsFactory(
        factoryVersioning,
        numberOfFixedRateFactories,
        FactoryInterfaces.FixedRateFactory
      );
    if (isFixedRateFactory) {
      _;
      return;
    }
    revert('Sender must be a Pool or FixedRate factory');
  }

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs SynthereumSyntheticTokenFactory contract
   * @param _synthereumFinder Synthereum finder contract
   */
  constructor(address _synthereumFinder) {
    synthereumFinder = ISynthereumFinder(_synthereumFinder);
  }

  /**
   * @notice Create a new token and return it to the caller.
   * @param tokenName used to describe the new token.
   * @param tokenSymbol short ticker abbreviation of the name. Ideally < 5 chars.
   * @param tokenDecimals used to define the precision used in the token's numerical representation.
   * @return newToken an instance of the newly created token interface.
   */
  function createToken(
    string memory tokenName,
    string memory tokenSymbol,
    uint8 tokenDecimals
  ) public virtual returns (BaseControlledMintableBurnableERC20 newToken);

  /**
   * @notice Set admin rol to the token
   * @param token Token on which the adim role is set
   */
  function _setAdminRole(BaseControlledMintableBurnableERC20 token) internal {
    token.addAdmin(msg.sender);
    token.renounceAdmin();
  }

  function _checkSenderIsFactory(
    ISynthereumFactoryVersioning factoryVersioning,
    uint8 numberOfFactories,
    bytes32 factoryKind
  ) internal view returns (bool isFactory) {
    uint8 counterFactory;
    for (uint8 i = 0; counterFactory < numberOfFactories; i++) {
      try factoryVersioning.getFactoryVersion(factoryKind, i) returns (
        address factory
      ) {
        if (msg.sender == factory) {
          isFactory = true;
          break;
        } else {
          counterFactory++;
          if (counterFactory == numberOfFactories) {
            isFactory = false;
          }
        }
      } catch {}
    }
  }
}
