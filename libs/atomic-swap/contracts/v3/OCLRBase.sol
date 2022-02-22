// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {
  ISynthereumRegistry
} from '@jarvis-network/synthereum-contracts/contracts/core/registries/interfaces/IRegistry.sol';
import {
  ISynthereumLiquidityPool
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v5/interfaces/ILiquidityPool.sol';
import {
  SynthereumInterfaces
} from '@jarvis-network/synthereum-contracts/contracts/core/Constants.sol';
import {IOCLRBase} from './interfaces/IOCLRBase.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

abstract contract OCLRBase is IOCLRBase {
  constructor() {}

  function checkSynthereumPool(
    ISynthereumFinder synthereumFinder,
    ISynthereumLiquidityPool synthereumPool
  ) internal view returns (IERC20 collateralInstance) {
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
