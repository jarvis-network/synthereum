// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';

interface ISynthereumFixedRateWrapperStorage {
  // Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  // Store important variables
  struct Storage {
    ISynthereumFinder finder;
  }
}
