// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {
  SelfMintingPerpetualLiquidatableMultiParty
} from './SelfMintingPerpetualLiquidatableMultiParty.sol';

contract SelfMintingPerpetualMultiParty is
  SelfMintingPerpetualLiquidatableMultiParty
{
  constructor(ConstructorParams memory params)
    public
    SelfMintingPerpetualLiquidatableMultiParty(params)
  {}
}
