// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IVault} from './interfaces/IVault.sol';
import {Vault} from './Vault.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {Clones} from '@openzeppelin/contracts/proxy/Clones.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPool.sol';

contract SynthereumMultiLPVaultCreator {
  using Clones for address;

  address public immutable vaultImplementation;

  event CreatedVault(address indexed vaultAddress, address indexed deployer);

  /**
   * @notice Constructs the Vault contract.
   * @param _vaultImplementation Address of the deployed vault implementation used for EIP1167
   */
  constructor(address _vaultImplementation) {
    vaultImplementation = _vaultImplementation;
  }

  function createVault(
    string memory _lpTokenName,
    string memory _lpTokenSymbol,
    address _pool,
    uint256 _overCollateralization
  ) public virtual returns (IVault vault) {
    require(bytes(_lpTokenName).length != 0, 'Missing LP token name');
    require(bytes(_lpTokenSymbol).length != 0, 'Missing LP token symbol');
    require(
      _overCollateralization > 0,
      'Overcollateral requirement must be bigger than 0%'
    );
    require(
      address(ISynthereumMultiLpLiquidityPool(_pool).collateralToken()) !=
        address(0),
      'Bad pool address'
    );

    // clone implementation
    vault = IVault(vaultImplementation.clone());

    // initialise it (as a constructor)
    vault.initialize(
      _lpTokenName,
      _lpTokenSymbol,
      _pool,
      _overCollateralization
    );

    emit CreatedVault(address(vault), msg.sender);
  }
}
