// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IVault} from './interfaces/IVault.sol';
import {Vault} from './Vault.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {ITypology} from '../common/interfaces/ITypology.sol';
import {
  TransparentUpgradeableProxy
} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

contract SynthereumMultiLPVaultCreator {
  address public immutable vaultImplementation;
  ISynthereumFinder immutable synthereumFinder;

  event CreatedVault(address indexed vaultAddress, address indexed deployer);

  /**
   * @notice Constructs the Vault contract.
   * @param _vaultImplementation Address of the deployed vault implementation used for proxy
   */
  constructor(address _vaultImplementation, address _finder) {
    require(_vaultImplementation != address(0), 'Bad vault implementation');
    require(_finder != address(0), 'Bad finder');
    synthereumFinder = ISynthereumFinder(_finder);
    vaultImplementation = _vaultImplementation;
  }

  function createVault(
    string memory _lpTokenName,
    string memory _lpTokenSymbol,
    address _pool,
    uint128 _overCollateralization
  ) public virtual returns (IVault vault) {
    require(isPool(_pool), 'Bad pool');
    require(bytes(_lpTokenName).length != 0, 'Missing LP token name');
    require(bytes(_lpTokenSymbol).length != 0, 'Missing LP token symbol');
    require(
      _overCollateralization > 0,
      'Overcollateral requirement must be bigger than 0%'
    );

    // deploy a transparent upgradable proxy and initialize implementation
    address vaultProxy =
      address(
        new TransparentUpgradeableProxy(
          vaultImplementation,
          synthereumFinder.getImplementationAddress(
            SynthereumInterfaces.Manager
          ),
          abi.encodeWithSelector(
            IVault.initialize.selector,
            _lpTokenName,
            _lpTokenSymbol,
            _pool,
            _overCollateralization,
            synthereumFinder
          )
        )
      );

    vault = IVault(vaultProxy);

    emit CreatedVault(vaultProxy, msg.sender);
  }

  function encodeParams(
    string memory _lpTokenName,
    string memory _lpTokenSymbol,
    address _pool,
    uint128 _overCollateralization
  ) public returns (bytes memory encoded) {
    return
      abi.encode(_lpTokenName, _lpTokenSymbol, _pool, _overCollateralization);
  }

  function decodeParams(bytes memory encodedParams)
    public
    returns (
      string memory,
      string memory,
      address,
      uint128
    )
  {
    return abi.decode(encodedParams, (string, string, address, uint128));
  }

  function encodeInitialiseCall(bytes memory encodedParams)
    public
    returns (bytes memory encodedCall)
  {
    (string memory name, string memory symbol, address pool, uint128 overColl) =
      decodeParams(encodedParams);
    encodedCall = abi.encodeWithSelector(
      IVault.initialize.selector,
      name,
      symbol,
      pool,
      overColl,
      synthereumFinder
    );
  }

  function isPool(address _pool) internal returns (bool) {
    try ITypology(_pool).typology() returns (string memory typologyString) {
      return
        keccak256(abi.encodePacked(typologyString)) ==
        keccak256(abi.encodePacked('POOL'));
    } catch {
      return false;
    }
  }
}
