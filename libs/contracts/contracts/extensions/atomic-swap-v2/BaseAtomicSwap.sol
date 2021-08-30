// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  ISynthereumRegistry
} from '../../../core/registries/interfaces/IRegistry.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {
  ISynthereumPoolOnChainPriceFeed
} from '../../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import {ImplementationInfo} from './IAtomicSwapV2.sol';
import './IAtomicSwapV2.sol';

contract BaseAtomicSwap {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  constructor() public {}

  function checkSynthereumPool(
    address synthereumFinderAddress,
    ISynthereumPoolOnChainPriceFeed synthereumPool
  ) internal view returns (IERC20 collateralInstance) {
    ISynthereumFinder memory synthereumFinder =
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
      'Pool not registred'
    );
  }
}
