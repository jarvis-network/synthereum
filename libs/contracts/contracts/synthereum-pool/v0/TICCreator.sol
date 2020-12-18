// SPDX-License-Identifier
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IDerivative} from '../../derivative/common/interfaces/IDerivative.sol';
import {SynthereumTICInterface} from './interfaces/ITIC.sol';
import {
  Lockable
} from '@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';
import {SynthereumTIC} from './TIC.sol';

contract TICCreator is Lockable {
  //----------------------------------------
  // State variables
  //----------------------------------------

  // Get a TIC using its token symbol
  mapping(string => SynthereumTIC) public symbolToTIC;
}
