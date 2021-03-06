// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  SelfMintingDerivativeFactory
} from '../derivative/self-minting/v1/SelfMintingDerivativeFactory.sol';

contract SelfMintingDerivativeFactoryMock is SelfMintingDerivativeFactory {
  constructor(
    address _synthereumFinder,
    address _umaFinder,
    address _timerAddress
  )
    public
    SelfMintingDerivativeFactory(_synthereumFinder, _umaFinder, _timerAddress)
  {}

  function setSynthereumFinder(ISynthereumFinder _synthereumFinder) external {
    synthereumFinder = _synthereumFinder;
  }
}
