// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {PerpetualPoolParty} from './PerpetualPoolParty.sol';

library PerpetualPoolPartyLib {
  function deploy(PerpetualPoolParty.ConstructorParams memory params)
    external
    returns (address)
  {
    PerpetualPoolParty derivative = new PerpetualPoolParty(params);
    return address(derivative);
  }
}
