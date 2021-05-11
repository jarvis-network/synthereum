// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {
  PerpetualLiquidatablePoolParty
} from './PerpetualLiquidatablePoolParty.sol';

contract PerpetualPoolParty is PerpetualLiquidatablePoolParty {
  constructor(ConstructorParams memory params)
    public
    PerpetualLiquidatablePoolParty(params)
  {}
}
