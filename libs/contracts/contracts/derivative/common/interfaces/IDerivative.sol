// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IDerivativeMain} from './IDerivativeMain.sol';
import {IDerivativeDeployment} from './IDerivativeDeployment.sol';

/**
 * @title Interface that a derivative MUST have in order to be used in the pools
 */
interface IDerivative is IDerivativeDeployment, IDerivativeMain {

}
