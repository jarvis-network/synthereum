// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  ISynthereumLiquidityPoolInteraction
} from './ILiquidityPoolInteraction.sol';
import {
  ISynthereumPoolDeployment
} from '../../common/interfaces/IPoolDeployment.sol';

interface ISynthereumLiquidityPoolGeneral is
  ISynthereumPoolDeployment,
  ISynthereumLiquidityPoolInteraction
{}
