// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {ISynthereumDeployer} from './interfaces/IDeployer.sol';
import {
  ISynthereumFactoryVersioning
} from './interfaces/IFactoryVersioning.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IDeploymentSignature} from './interfaces/IDeploymentSignature.sol';
import {
  ISynthereumPoolDeployment
} from '../synthereum-pool/common/interfaces/IPoolDeployment.sol';
import {
  IDerivativeDeployment
} from '../derivative/common/interfaces/IDerivativeDeployment.sol';
import {SynthereumInterfaces} from './Constants.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/EnumerableSet.sol';
import {
  Lockable
} from '@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

contract SynthereumDeployer is ISynthereumDeployer, AccessControl, Lockable {
  using Address for address;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  //----------------------------------------
  // State variables
  //----------------------------------------

  ISynthereumFinder public synthereumFinder;

  //map with key (synthetic token symbol, collateral address, synthereum version) and values an array of Pools
  mapping(string => mapping(IERC20 => mapping(uint8 => EnumerableSet.AddressSet)))
    private symbolToPools;

  //----------------------------------------
  // Events
  //----------------------------------------
  event PoolDeployed(
    uint8 indexed poolVersion,
    address indexed derivative,
    address newPool
  );
  event DerivativeDeployed(
    uint8 indexed derivativeVersion,
    address indexed pool,
    address newDerivative
  );

  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs the SynthereumDeployer contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _roles Admin and Mainteiner roles
   */
  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles) public {
    synthereumFinder = _synthereumFinder;
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Deploy derivative and pool linking the contracts together
   * @param derivativeVersion Version of derivative contract
   * @param poolVersion Version of the pool contract
   * @param derivativeParamsData Input params of derivative constructor
   * @param poolParamsData Input params of pool constructor
   * @return derivative Derivative contract deployed
   * @return pool Pool contract deployed
   */
  function deployPoolAndDerivative(
    uint8 derivativeVersion,
    uint8 poolVersion,
    bytes calldata derivativeParamsData,
    bytes calldata poolParamsData
  )
    external
    override
    onlyMaintainer
    nonReentrant
    returns (IDerivativeDeployment derivative, ISynthereumPoolDeployment pool)
  {
    ISynthereumFactoryVersioning factoryVersioning = getFactoryVersioning();
    derivative = deployDerivative(
      factoryVersioning,
      derivativeVersion,
      derivativeParamsData
    );
    checkDerivativeRoles(derivative);
    pool = deployPool(
      factoryVersioning,
      poolVersion,
      derivative,
      poolParamsData
    );
    checkPoolDeployment(pool, poolVersion);
    checkPoolAndDerivativeMatching(pool, derivative);
    setDerivativeRoles(derivative, pool);
    symbolToPools[pool.syntheticTokenSymbol()][pool.collateralToken()][
      poolVersion
    ]
      .add(address(pool));
    emit PoolDeployed(poolVersion, address(derivative), address(pool));
    emit DerivativeDeployed(
      derivativeVersion,
      address(pool),
      address(derivative)
    );
  }

  /**
   * @notice Deploy pool and links it with an already existing derivative
   * @param poolVersion Version of the pool contract
   * @param poolParamsData Input params of pool constructor
   * @param derivative Existing derivative contract to link with the new pool
   * @return pool Pool contract deployed
   */
  function deployOnlyPool(
    uint8 poolVersion,
    bytes calldata poolParamsData,
    IDerivativeDeployment derivative
  )
    external
    override
    onlyMaintainer
    nonReentrant
    returns (ISynthereumPoolDeployment pool)
  {
    ISynthereumFactoryVersioning factoryVersioning = getFactoryVersioning();
    pool = deployPool(
      factoryVersioning,
      poolVersion,
      derivative,
      poolParamsData
    );
    checkPoolDeployment(pool, poolVersion);
    checkPoolAndDerivativeMatching(pool, derivative);
    symbolToPools[pool.syntheticTokenSymbol()][pool.collateralToken()][
      poolVersion
    ]
      .add(address(pool));
    emit PoolDeployed(poolVersion, address(derivative), address(pool));
  }

  /**
   * @notice Deploy derivative and links it with an already existing pool
   * @param derivativeVersion Version of the derivative contract
   * @param derivativeParamsData Input params of derivative constructor
   * @param pool Existing pool contract to link with the new derivative
   * @return derivative Derivative contract deployed
   */
  function deployOnlyDerivative(
    uint8 derivativeVersion,
    bytes calldata derivativeParamsData,
    ISynthereumPoolDeployment pool
  )
    external
    override
    onlyMaintainer
    nonReentrant
    returns (IDerivativeDeployment derivative)
  {
    ISynthereumFactoryVersioning factoryVersioning = getFactoryVersioning();
    derivative = deployDerivative(
      factoryVersioning,
      derivativeVersion,
      derivativeParamsData
    );
    checkDerivativeRoles(derivative);
    checkPoolAndDerivativeMatching(pool, derivative);
    setDerivativeRoles(derivative, pool);
    emit DerivativeDeployed(
      derivativeVersion,
      address(pool),
      address(derivative)
    );
  }

  //----------------------------------------
  // External view functions
  //----------------------------------------

  /**
   * @notice Returns if a particular pool exists or not
   * @param poolSymbol Synthetic token symbol of the pool
   * @param collateral ERC20 contract of collateral currency
   * @param poolVersion Version of the pool
   * @param pool Contract of the pool to check
   * @return isDeployed Returns truei f a particular pool exists otherwiise false
   */
  function isPoolDeployed(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion,
    ISynthereumPoolDeployment pool
  ) external view override nonReentrantView returns (bool isDeployed) {
    isDeployed = symbolToPools[poolSymbol][collateral][poolVersion].contains(
      address(pool)
    );
  }

  /**
   * @notice Returns all the pools with partcular symbol, collateral and verion
   * @param poolSymbol Synthetic token symbol of the pool
   * @param collateral ERC20 contract of collateral currency
   * @param poolVersion Version of the pool
   * @return List of all pools
   */
  function getPools(
    string calldata poolSymbol,
    IERC20 collateral,
    uint8 poolVersion
  ) external view override nonReentrantView returns (address[] memory) {
    EnumerableSet.AddressSet storage poolSet =
      symbolToPools[poolSymbol][collateral][poolVersion];
    uint256 numberOfPools = poolSet.length();
    address[] memory pools = new address[](numberOfPools);
    for (uint256 j = 0; j < numberOfPools; j++) {
      pools[j] = poolSet.at(j);
    }
    return pools;
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------

  /**
   * @notice Deploy a derivative contract of a particular version
   * @param factoryVersioning factory versioning contract
   * @param derivativeVersion Version of derivate contract to deploy
   * @param derivativeParamsData Input parameters of constructor of derivative
   * @return derivative derivative deployed
   */
  function deployDerivative(
    ISynthereumFactoryVersioning factoryVersioning,
    uint8 derivativeVersion,
    bytes memory derivativeParamsData
  ) internal returns (IDerivativeDeployment derivative) {
    address derivativeFactory =
      factoryVersioning.getDerivativeFactoryVersion(derivativeVersion);
    bytes memory derivativeDeploymentResult =
      derivativeFactory.functionCall(
        abi.encodePacked(
          getDeploymentSignature(derivativeFactory),
          derivativeParamsData
        ),
        'Wrong derivative deployment'
      );
    derivative = IDerivativeDeployment(
      abi.decode(derivativeDeploymentResult, (address))
    );
  }

  /**
   * @notice Deploy a pool contract of a particular version
   * @param factoryVersioning factory versioning contract
   * @param poolVersion Version of pool contract to deploy
   * @param poolParamsData Input parameters of constructor of the pool
   * @return pool pool deployed
   */
  function deployPool(
    ISynthereumFactoryVersioning factoryVersioning,
    uint8 poolVersion,
    IDerivativeDeployment derivative,
    bytes memory poolParamsData
  ) internal returns (ISynthereumPoolDeployment pool) {
    address poolFactory = factoryVersioning.getPoolFactoryVersion(poolVersion);
    bytes memory poolDeploymentResult =
      poolFactory.functionCall(
        abi.encodePacked(
          getDeploymentSignature(poolFactory),
          bytes32(uint256(address(derivative))),
          poolParamsData
        ),
        'Wrong pool deployment'
      );
    pool = ISynthereumPoolDeployment(
      abi.decode(poolDeploymentResult, (address))
    );
  }

  /**
   * @notice Assign roles of the derivative contract to a pool
   * @param derivative Derivative contract
   * @param pool Pool contract
   */
  function setDerivativeRoles(
    IDerivativeDeployment derivative,
    ISynthereumPoolDeployment pool
  ) internal {
    address poolAddr = address(pool);
    derivative.addAdminAndPool(poolAddr);
    derivative.renounceAdmin();
  }

  //----------------------------------------
  // Internal view functions
  //----------------------------------------

  /**
   * @notice Get factory versioning contract from the finder
   * @param factoryVersioning Factory versioning contract
   */
  function getFactoryVersioning()
    internal
    view
    returns (ISynthereumFactoryVersioning factoryVersioning)
  {
    factoryVersioning = ISynthereumFactoryVersioning(
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.FactoryVersioning
      )
    );
  }

  /**
   * @notice Get signature of function to deploy a contract
   * @param signature Signature of deployment function
   */
  function getDeploymentSignature(address deploymentContract)
    internal
    view
    returns (bytes4 signature)
  {
    signature = IDeploymentSignature(deploymentContract).deploymentSignature();
  }

  /**
   * @notice Check derivative roles temporarily assigned to the deployer
   * @param derivative Derivative contract
   */
  function checkDerivativeRoles(IDerivativeDeployment derivative)
    internal
    view
  {
    address[] memory derivativeAdmins = derivative.getAdminMembers();
    require(derivativeAdmins.length == 1, 'The derivative must have one admin');
    require(
      derivativeAdmins[0] == address(this),
      'The derivative admin msut be the deployer'
    );
    address[] memory derivativePools = derivative.getPoolMembers();
    require(derivativePools.length == 0, 'The derivative must have no pools');
  }

  /**
   * @notice Check correct finder and version of the deployed pool
   * @param pool Contract pool to check
   * @param pool Pool version to check
   */
  function checkPoolDeployment(ISynthereumPoolDeployment pool, uint8 version)
    internal
    view
  {
    require(
      pool.synthereumFinder() == synthereumFinder,
      'Wrong finder in pool deployment'
    );
    require(pool.version() == version, 'Wrong version in pool deployment');
  }

  /**
   * @notice Check correct collateral and synthetic token matching between pool and derivative
   * @param pool Pool contract
   * @param derivative Derivative contract
   */
  function checkPoolAndDerivativeMatching(
    ISynthereumPoolDeployment pool,
    IDerivativeDeployment derivative
  ) internal view {
    require(
      pool.collateralToken() == derivative.collateralCurrency(),
      'Wrong collateral matching'
    );
    require(
      pool.syntheticToken() == derivative.tokenCurrency(),
      'Wrong synthetic token matching'
    );
  }
}
