// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.4;

import '@jarvis-network/synthereum-contracts/contracts/test/UmaInfra.sol';
import {
  PerpetualPoolParty
} from '@jarvis-network/synthereum-contracts/contracts/derivative/v2/PerpetualPoolParty.sol';
import {
  PoolMock
} from '@jarvis-network/synthereum-contracts/contracts/test/PoolMock.sol';
import {
  SynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/Finder.sol';
import {
  SynthereumDeployer
} from '@jarvis-network/synthereum-contracts/contracts/core/Deployer.sol';
import {
  SynthereumManager
} from '@jarvis-network/synthereum-contracts/contracts/core/Manager.sol';
import {
  SynthereumPoolOnChainPriceFeedLib
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/PoolOnChainPriceFeedLib.sol';
import {
  SynthereumPoolOnChainPriceFeedFactory
} from '@jarvis-network/synthereum-contracts/contracts/synthereum-pool/v4/PoolOnChainPriceFeedFactory.sol';
import {
  SynthereumPoolRegistry
} from '@jarvis-network/synthereum-contracts/contracts/core/registries/PoolRegistry.sol';
import {
  SynthereumFactoryVersioning
} from '@jarvis-network/synthereum-contracts/contracts/core/FactoryVersioning.sol';
import {
  SynthereumSyntheticTokenPermitFactory
} from '@jarvis-network/synthereum-contracts/contracts/tokens/factories/SyntheticTokenPermitFactory.sol';
import {
  SynthereumSyntheticTokenFactory
} from '@jarvis-network/synthereum-contracts/contracts/tokens/factories/SyntheticTokenFactory.sol';
import {
  PerpetualPoolPartyLib
} from '@jarvis-network/synthereum-contracts/contracts/derivative/v2/PerpetualPoolPartyLib.sol';
import {
  PerpetualLiquidatablePoolPartyLib
} from '@jarvis-network/synthereum-contracts/contracts/derivative/v2/PerpetualLiquidatablePoolPartyLib.sol';
import {
  PerpetualPositionManagerPoolPartyLib
} from '@jarvis-network/synthereum-contracts/contracts/derivative/v2/PerpetualPositionManagerPoolPartyLib.sol';
import {
  FeePayerPartyLib
} from '@jarvis-network/synthereum-contracts/contracts/derivative/common/FeePayerPartyLib.sol';
import {
  SynthereumDerivativeFactory
} from '@jarvis-network/synthereum-contracts/contracts/derivative/v2/DerivativeFactory.sol';
import {
  AddressWhitelist
} from '@uma/core/contracts/common/implementation/AddressWhitelist.sol';
import {
  TestnetERC20
} from '@uma/core/contracts/common/implementation/TestnetERC20.sol';
import {
  SynthereumChainlinkPriceFeed
} from '@jarvis-network/synthereum-contracts/contracts/oracle/chainlink/ChainlinkPriceFeed.sol';
import {
  MockAggregator
} from '@jarvis-network/synthereum-contracts/contracts/test/MockAggregator.sol';
import {
  MockRandomAggregator
} from '@jarvis-network/synthereum-contracts/contracts/test/MockRandomAggregator.sol';
import {FixedRateWrapper} from '../fixed-rate-currency/FixedRateWrapper.sol';
import {FixedRateCurrency} from '../fixed-rate-currency/FixedRateCurrency.sol';
import {
  IAtomicSwap
} from '@jarvis-network/atomic-swap/contracts/interfaces/IAtomicSwap.sol';
import {AtomicSwap} from '@jarvis-network/atomic-swap/contracts/AtomicSwap.sol';
import {Maastricht} from '../Maastricht/Maastricht.sol';
