// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {
  SelfMintingPerpetualMultiParty
} from './SelfMintingPerpetualMultiParty.sol';

library SelfMintingPerpetualMultiPartyLib {
  function deploy(
    SelfMintingPerpetualMultiParty.ConstructorParams memory params
  ) external returns (address) {
    SelfMintingPerpetualMultiParty derivative =
      new SelfMintingPerpetualMultiParty(params);
    return address(derivative);
  }
}
