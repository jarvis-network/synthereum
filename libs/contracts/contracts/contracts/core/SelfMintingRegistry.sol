// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {ISelfMintingRegistry} from './interfaces/ISelfMintingRegistry.sol';
import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {IERC20} from '../../@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SynthereumInterfaces} from './Constants.sol';
import {
  EnumerableSet
} from '../../@openzeppelin/contracts/utils/EnumerableSet.sol';
import {
  Lockable
} from '../../@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';

contract SelfMintingRegistry is ISelfMintingRegistry, Lockable {
  using EnumerableSet for EnumerableSet.AddressSet;

  ISynthereumFinder public synthereumFinder;

  mapping(string => mapping(IERC20 => mapping(uint8 => EnumerableSet.AddressSet)))
    private symbolToSelfMintingDerivatives;

  EnumerableSet.AddressSet private collaterals;

  constructor(ISynthereumFinder _synthereumFinder) public {
    synthereumFinder = _synthereumFinder;
  }

  function registerSelfMintingDerivative(
    string calldata syntheticTokenSymbol,
    IERC20 collateralToken,
    uint8 selfMintingVersion,
    address selfMintingDerivative
  ) external override nonReentrant {
    address deployer =
      ISynthereumFinder(synthereumFinder).getImplementationAddress(
        SynthereumInterfaces.Deployer
      );
    require(msg.sender == deployer, 'Sender must be Synthereum deployer');
    symbolToSelfMintingDerivatives[syntheticTokenSymbol][collateralToken][
      selfMintingVersion
    ]
      .add(selfMintingDerivative);
    collaterals.add(address(collateralToken));
  }

  function isSelfMintingDerivativeDeployed(
    string calldata selfMintingDerivativeSymbol,
    IERC20 collateral,
    uint8 selfMintingVersion,
    address selfMintingDerivative
  ) external view override nonReentrantView returns (bool isDeployed) {
    isDeployed = symbolToSelfMintingDerivatives[selfMintingDerivativeSymbol][
      collateral
    ][selfMintingVersion]
      .contains(selfMintingDerivative);
  }

  function getSelfMintingDerivatives(
    string calldata selfMintingDerivativeSymbol,
    IERC20 collateral,
    uint8 selfMintingVersion
  ) external view override nonReentrantView returns (address[] memory) {
    EnumerableSet.AddressSet storage selfMintingSet =
      symbolToSelfMintingDerivatives[selfMintingDerivativeSymbol][collateral][
        selfMintingVersion
      ];
    uint256 numberOfDerivatives = selfMintingSet.length();
    address[] memory selfMintingDerivatives =
      new address[](numberOfDerivatives);
    for (uint256 j = 0; j < numberOfDerivatives; j++) {
      selfMintingDerivatives[j] = selfMintingSet.at(j);
    }
    return selfMintingDerivatives;
  }

  function getCollaterals()
    external
    view
    override
    nonReentrantView
    returns (address[] memory)
  {
    uint256 numberOfCollaterals = collaterals.length();
    address[] memory collateralAddresses = new address[](numberOfCollaterals);
    for (uint256 j = 0; j < numberOfCollaterals; j++) {
      collateralAddresses[j] = collaterals.at(j);
    }
    return collateralAddresses;
  }
}
