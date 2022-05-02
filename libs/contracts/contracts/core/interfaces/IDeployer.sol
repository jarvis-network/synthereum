// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  ISynthereumPoolDeployment
} from '../../synthereum-pool/common/interfaces/IPoolDeployment.sol';
import {
  ISelfMintingDerivativeDeployment
} from '../../derivative/self-minting/common/interfaces/ISelfMintingDerivativeDeployment.sol';

/**
 * @title Provides interface with functions of Synthereum deployer
 */
interface ISynthereumDeployer {
  /**
   * @notice Deploy a new pool
   * @param poolVersion Version of the pool contract
   * @param poolParamsData Input params of pool constructor
   * @return pool Pool contract deployed
   */
  function deployPool(uint8 poolVersion, bytes calldata poolParamsData)
    external
    returns (ISynthereumPoolDeployment pool);

  /**
   * @notice Deploy a new self minting derivative contract
   * @param selfMintingDerVersion Version of the self minting derivative contract
   * @param selfMintingDerParamsData Input params of self minting derivative constructor
   * @return selfMintingDerivative Self minting derivative contract deployed
   */
  function deploySelfMintingDerivative(
    uint8 selfMintingDerVersion,
    bytes calldata selfMintingDerParamsData
  ) external returns (ISelfMintingDerivativeDeployment selfMintingDerivative);
}
