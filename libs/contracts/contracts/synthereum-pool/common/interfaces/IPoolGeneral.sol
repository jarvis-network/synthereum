// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumPoolInteraction} from './IPoolInteraction.sol';
import {ISynthereumPoolDeployment} from './IPoolDeployment.sol';

interface ISynthereumPoolGeneral is
  ISynthereumPoolDeployment,
  ISynthereumPoolInteraction
{}
