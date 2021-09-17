// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {
  ISynthereumAutonomousPoolInteraction
} from './IAutonomousPoolInteraction.sol';
import {
  ISynthereumPoolDeployment
} from '../../common/interfaces/IPoolDeployment.sol';

interface ISynthereumAutonomousPoolGeneral is
  ISynthereumPoolDeployment,
  ISynthereumAutonomousPoolInteraction
{}
