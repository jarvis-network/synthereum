// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {SynthereumRegistry} from './Registry.sol';
import {ISynthereumFinder} from '../interfaces/IFinder.sol';

contract SelfMintingRegistry is SynthereumRegistry {
  constructor(ISynthereumFinder _synthereumFinder)
    public
    SynthereumRegistry('SELF MINTING REGISTRY', _synthereumFinder)
  {}
}
