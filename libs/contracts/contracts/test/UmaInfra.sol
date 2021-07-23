// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {Finder} from '@uma/core/contracts/oracle/implementation/Finder.sol';
import {Timer} from '@uma/core/contracts/common/implementation/Timer.sol';
import {
  VotingToken
} from '@uma/core/contracts/oracle/implementation/VotingToken.sol';
import {
  TokenMigrator
} from '@uma/core/contracts/oracle/implementation/TokenMigrator.sol';
import {Voting} from '@uma/core/contracts/oracle/implementation/Voting.sol';
import {
  IdentifierWhitelist
} from '@uma/core/contracts/oracle/implementation/IdentifierWhitelist.sol';
import {Registry} from '@uma/core/contracts/oracle/implementation/Registry.sol';
import {
  FinancialContractsAdmin
} from '@uma/core/contracts/oracle/implementation/FinancialContractsAdmin.sol';
import {Store} from '@uma/core/contracts/oracle/implementation/Store.sol';
import {Governor} from '@uma/core/contracts/oracle/implementation/Governor.sol';
import {
  DesignatedVotingFactory
} from '@uma/core/contracts/oracle/implementation/DesignatedVotingFactory.sol';
import {
  TestnetERC20
} from '@uma/core/contracts/common/implementation/TestnetERC20.sol';
import {
  OptimisticOracle
} from '@uma/core/contracts/oracle/implementation/OptimisticOracle.sol';
import {MockOracle} from '@uma/core/contracts/oracle/test/MockOracle.sol';
