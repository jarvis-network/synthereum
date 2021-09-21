// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {
  ISynthereumRegistry
} from '@jarvis-network/synthereum-contracts/contracts/core/registries/interfaces/IRegistry.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {
  ISynthereumPoolOnChainPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import {
  SynthereumInterfaces
} from '@jarvis-network/synthereum-contracts/contracts/core/Constants.sol';

import './interfaces/IAtomicSwapV2.sol';

contract BaseAtomicSwap {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  constructor() {}

  function checkSynthereumPool(
    address synthereumFinderAddress,
    ISynthereumPoolOnChainPriceFeed synthereumPool
  ) internal view returns (IERC20 collateralInstance) {
    ISynthereumFinder synthereumFinder =
      ISynthereumFinder(synthereumFinderAddress);
    ISynthereumRegistry poolRegistry =
      ISynthereumRegistry(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.PoolRegistry
        )
      );
    string memory synthTokenSymbol = synthereumPool.syntheticTokenSymbol();
    collateralInstance = synthereumPool.collateralToken();
    uint8 version = synthereumPool.version();
    require(
      poolRegistry.isDeployed(
        synthTokenSymbol,
        collateralInstance,
        version,
        address(synthereumPool)
      ),
      'Pool not registered'
    );
  }
}
