// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IVault} from './interfaces/IVault.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {ISynthereumRegistry} from '../core/registries/interfaces/IRegistry.sol';
import {ISynthereumDeployment} from '../common/interfaces/IDeployment.sol';
import {
  TransparentUpgradeableProxy
} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

contract SynthereumMultiLPVaultCreator {
  address internal immutable vaultImpl;
  ISynthereumFinder immutable synthereumFinder;

  /**
   * @notice Constructs the Vault contract.
   * @param _finder Address of the synthereum finder
   * @param _vaultImplementation Address of the deployed vault implementation used for proxy
   */
  constructor(address _finder, address _vaultImplementation) {
    require(_vaultImplementation != address(0), 'Bad vault implementation');
    require(_finder != address(0), 'Bad finder');
    synthereumFinder = ISynthereumFinder(_finder);
    vaultImpl = _vaultImplementation;
  }

  /**
   * @notice Deploy a vault
   * @param _lpTokenName name of the LP token representing a share in the vault
   * @param _lpTokenSymbol symbol of the LP token representing a share in the vault
   * @param _pool address of MultiLP pool the vault interacts with
   * @param _overCollateralization over collateral requirement of the vault position in the pool
   * @return vault Deployed vault
   */
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
          vaultImpl,
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
  }

  /**
   * @notice Returns address of deployed vault implementation the factory is using
   * @return implementation Vault implementation
   */
  function vaultImplementation() public virtual returns (address) {
    return vaultImpl;
  }

  /**
   * @notice ABI Encodes vault initialise method to construct a vault during deployment
   * @param encodedParams ABI encoded parameters for constructor
   * @return encodedCall Encoded function call with parameters
   */
  function encodeInitialiseCall(bytes memory encodedParams)
    public
    virtual
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

  /**
   * @notice Decodes constructor parameters into proper types
   * @param encodedParams ABI encoded parameters for constructor
   * @return LPTokenName string of LP token name
   * @return LPTokenSymbol string of LP token symbol
   * @return pool address of the reference synthereum pool
   * @return overcollateralization uint128 Overcollateralization factor of the vault as LP
   */
  function decodeParams(bytes memory encodedParams)
    internal
    returns (
      string memory,
      string memory,
      address,
      uint128
    )
  {
    return abi.decode(encodedParams, (string, string, address, uint128));
  }

  /**
   * @notice Checks if address is a deployed and valid synthereum pool
   * @param _pool address of the pool to check
   * @return bool
   */
  function isPool(address _pool) internal returns (bool) {
    ISynthereumRegistry registry =
      ISynthereumRegistry(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.PoolRegistry
        )
      );
    ISynthereumDeployment callingContract = ISynthereumDeployment(_pool);
    return
      registry.isDeployed(
        callingContract.syntheticTokenSymbol(),
        callingContract.collateralToken(),
        callingContract.version(),
        _pool
      );
  }
}
