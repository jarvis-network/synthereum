// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumFactoryVersioning
} from '../../core/interfaces/IFactoryVersioning.sol';
import {
  MintableBurnableIERC20
} from '@jarvis-network/uma-core/contracts/common/interfaces/MintableBurnableIERC20.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {
  MintableBurnableTokenFactory
} from '@jarvis-network/uma-core/contracts/financial-templates/common/MintableBurnableTokenFactory.sol';

contract SynthereumSyntheticTokenFactory is MintableBurnableTokenFactory {
  //----------------------------------------
  // State variables
  //----------------------------------------

  address public synthereumFinder;

  uint8 public derivativeVersion;

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs SynthereumSyntheticTokenFactory contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _derivativeVersion Version of the derivative that controls this token factory
   */
  constructor(address _synthereumFinder, uint8 _derivativeVersion) public {
    synthereumFinder = _synthereumFinder;
    derivativeVersion = _derivativeVersion;
  }

  /**
   * @notice Check if the sender is a derivative Factory and deploy a new synthetic token
   * @param tokenName used to describe the new token
   * @param tokenSymbol short ticker abbreviation of the name. Ideally < 5 chars
   * @param tokenDecimals used to define the precision used in the token's numerical representation
   * @return newToken an instance of the newly created token interface.
   */
  function createToken(
    string calldata tokenName,
    string calldata tokenSymbol,
    uint8 tokenDecimals
  ) public override returns (MintableBurnableIERC20 newToken) {
    ISynthereumFactoryVersioning factoryVersioning =
      ISynthereumFactoryVersioning(
        ISynthereumFinder(synthereumFinder).getImplementationAddress(
          SynthereumInterfaces.FactoryVersioning
        )
      );
    require(
      msg.sender ==
        factoryVersioning.getDerivativeFactoryVersion(derivativeVersion),
      'Sender must be a Derivative Factory'
    );
    newToken = super.createToken(tokenName, tokenSymbol, tokenDecimals);
  }
}
