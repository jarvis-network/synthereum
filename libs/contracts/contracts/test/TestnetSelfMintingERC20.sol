// SPDX-License-Identifier: AGPL-3.0-only

import {
  TestnetERC20
} from '@jarvis-network/uma-core/contracts/common/implementation/TestnetERC20.sol';

contract TestnetSelfMintingERC20 is TestnetERC20 {
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  ) public TestnetERC20(_name, _symbol, _decimals) {}
}
