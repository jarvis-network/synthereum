// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumFactoryVersioning
} from '../../core/interfaces/IFactoryVersioning.sol';
import {MintableBurnableIERC20} from './interfaces/MintableBurnableIERC20.sol';
import {
  SynthereumInterfaces,
  FactoryInterfaces
} from '../../core/Constants.sol';
import {MintableBurnableTokenFactory} from './MintableBurnableTokenFactory.sol';

contract SynthereumSyntheticTokenFactory is MintableBurnableTokenFactory {
  ISynthereumFinder public synthereumFinder;

  modifier onlyDerivativeFactory() {
    ISynthereumFactoryVersioning factoryVersioning =
      ISynthereumFactoryVersioning(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.FactoryVersioning
        )
      );
    uint256 numberOfFactories =
      factoryVersioning.numberOfVerisonsOfFactory(
        FactoryInterfaces.DerivativeFactory
      );
    uint256 counter = 0;
    for (uint8 i = 0; counter < numberOfFactories; i++) {
      try
        factoryVersioning.getFactoryVersion(
          FactoryInterfaces.DerivativeFactory,
          i
        )
      returns (address factory) {
        if (msg.sender == factory) {
          _;
          break;
        } else {
          counter++;
        }
      } catch {}
    }
    if (numberOfFactories == counter) {
      revert('Sender must be a derivative factory');
    }
  }

  constructor(address _synthereumFinder) public {
    synthereumFinder = ISynthereumFinder(_synthereumFinder);
  }

  function createToken(
    string calldata tokenName,
    string calldata tokenSymbol,
    uint8 tokenDecimals
  )
    public
    override
    onlyDerivativeFactory
    returns (MintableBurnableIERC20 newToken)
  {
    newToken = super.createToken(tokenName, tokenSymbol, tokenDecimals);
  }
}
