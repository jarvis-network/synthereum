// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {IERC20} from '../../../@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  ISynthereumPoolDeployment
} from '../../synthereum-pool/common/interfaces/IPoolDeployment.sol';
import {
  IExtendedDerivativeDeployment
} from '../../derivative/common/interfaces/IExtendedDerivativeDeployment.sol';
import {
  EnumerableSet
} from '../../../@openzeppelin/contracts/utils/EnumerableSet.sol';

interface ISynthereumDeployer {
  function deployPoolAndDerivative(
    uint8 derivativeVersion,
    uint8 poolVersion,
    bytes calldata derivativeParamsData,
    bytes calldata poolParamsData
  )
    external
    returns (
      IExtendedDerivativeDeployment derivative,
      ISynthereumPoolDeployment pool
    );

  function deployOnlyPool(
    uint8 poolVersion,
    bytes calldata poolParamsData,
    IExtendedDerivativeDeployment derivative
  ) external returns (ISynthereumPoolDeployment pool);

  function deployOnlyDerivative(
    uint8 derivativeVersion,
    bytes calldata derivativeParamsData,
    ISynthereumPoolDeployment pool
  ) external returns (IExtendedDerivativeDeployment derivative);
}
