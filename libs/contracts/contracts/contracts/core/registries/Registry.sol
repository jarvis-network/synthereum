// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {ISynthereumRegistry} from './interfaces/IRegistry.sol';
import {ISynthereumFinder} from '../interfaces/IFinder.sol';
import {IERC20} from '../../../@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SynthereumInterfaces} from '../Constants.sol';
import {
  EnumerableSet
} from '../../../@openzeppelin/contracts/utils/EnumerableSet.sol';
import {EnumerableBytesSet} from '../../base/utils/EnumerableBytesSet.sol';
import {StringUtils} from '../../base/utils/StringUtils.sol';
import {
  Lockable
} from '../../../@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';

contract SynthereumRegistry is ISynthereumRegistry, Lockable {
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableBytesSet for EnumerableBytesSet.BytesSet;
  using StringUtils for string;
  using StringUtils for bytes32;

  string public registryType;

  ISynthereumFinder public synthereumFinder;

  mapping(string => mapping(IERC20 => mapping(uint8 => EnumerableSet.AddressSet)))
    private symbolToPools;

  EnumerableBytesSet.BytesSet private syntheticTokens;

  EnumerableSet.AddressSet private collaterals;

  EnumerableSet.UintSet private versions;

  constructor(string memory _registryType, ISynthereumFinder _synthereumFinder)
    public
  {
    synthereumFinder = _synthereumFinder;
    registryType = _registryType;
  }

  function register(
    string calldata syntheticTokenSymbol,
    IERC20 collateralToken,
    uint8 poolVersion,
    address pool
  ) external override nonReentrant {
    address deployer =
      ISynthereumFinder(synthereumFinder).getImplementationAddress(
        SynthereumInterfaces.Deployer
      );
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    symbolToPools[syntheticTokenSymbol][collateralToken][poolVersion].add(pool);
    syntheticTokens.add(syntheticTokenSymbol.stringToBytes32());
    collaterals.add(address(collateralToken));
    versions.add(poolVersion);
  }

  function isDeployed(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion,
    address pool
  ) external view override returns (bool isElementDeployed) {
    isElementDeployed = symbolToPools[poolSymbol][collateral][poolVersion]
      .contains(pool);
  }

  function getElements(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion
  ) external view override returns (address[] memory) {
    EnumerableSet.AddressSet storage poolSet =
      symbolToPools[poolSymbol][collateral][poolVersion];
    uint256 numberOfPools = poolSet.length();
    address[] memory pools = new address[](numberOfPools);
    for (uint256 j = 0; j < numberOfPools; j++) {
      pools[j] = poolSet.at(j);
    }
    return pools;
  }

  function getSyntheticTokens()
    external
    view
    override
    returns (string[] memory)
  {
    uint256 numberOfSynthTokens = syntheticTokens.length();
    string[] memory synthTokens = new string[](numberOfSynthTokens);
    for (uint256 j = 0; j < numberOfSynthTokens; j++) {
      synthTokens[j] = syntheticTokens.at(j).bytes32ToString();
    }
    return synthTokens;
  }

  function getVersions() external view override returns (uint8[] memory) {
    uint256 numberOfVersions = versions.length();
    uint8[] memory actualVersions = new uint8[](numberOfVersions);
    for (uint256 j = 0; j < numberOfVersions; j++) {
      actualVersions[j] = uint8(versions.at(j));
    }
    return actualVersions;
  }

  function getCollaterals() external view override returns (address[] memory) {
    uint256 numberOfCollaterals = collaterals.length();
    address[] memory collateralAddresses = new address[](numberOfCollaterals);
    for (uint256 j = 0; j < numberOfCollaterals; j++) {
      collateralAddresses[j] = collaterals.at(j);
    }
    return collateralAddresses;
  }
}
