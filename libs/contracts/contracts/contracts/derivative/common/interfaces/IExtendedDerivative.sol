// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IDerivative} from './IDerivative.sol';
import {
  IExtendedDerivativeDeployment
} from './IExtendedDerivativeDeployment.sol';

interface IExtendedDerivative is IExtendedDerivativeDeployment, IDerivative {}
