// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {ISynthereumDeployer} from './interfaces/IDeployer.sol';
import {
  ISynthereumFactoryVersioning
} from './interfaces/IFactoryVersioning.sol';
import {ISynthereumPoolRegistry} from './interfaces/IPoolRegistry.sol';
import {ISelfMintingRegistry} from './interfaces/ISelfMintingRegistry.sol';
import {ISynthereumManager} from './interfaces/IManager.sol';
import {IERC20} from '../../@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IDeploymentSignature} from './interfaces/IDeploymentSignature.sol';
import {
  ISynthereumPoolDeployment
} from '../synthereum-pool/common/interfaces/IPoolDeployment.sol';
import {
  IDerivativeDeployment
} from '../derivative/common/interfaces/IDerivativeDeployment.sol';
import {
  ISelfMintingDerivativeDeployment
} from '../derivative/self-minting/common/interfaces/ISelfMintingDerivativeDeployment.sol';
import {IRole} from '../base/interfaces/IRole.sol';
import {SynthereumInterfaces} from './Constants.sol';
import {Address} from '../../@openzeppelin/contracts/utils/Address.sol';
import {
  EnumerableSet
} from '../../@openzeppelin/contracts/utils/EnumerableSet.sol';
import {
  Lockable
} from '../../@jarvis-network/uma-core/contracts/common/implementation/Lockable.sol';
import {
  AccessControl
} from '../../@openzeppelin/contracts/access/AccessControl.sol';

contract SynthereumDeployer is ISynthereumDeployer, AccessControl, Lockable {
  using Address for address;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  bytes32 private constant ADMIN_ROLE = 0x00;

  bytes32 private constant POOL_ROLE = keccak256('Pool');

  bytes32 private constant MINTER_ROLE = keccak256('Minter');

  bytes32 private constant BURNER_ROLE = keccak256('Burner');

  struct Roles {
    address admin;
    address maintainer;
  }

  ISynthereumFinder public synthereumFinder;

  event PoolDeployed(
    uint8 indexed poolVersion,
    address indexed derivative,
    address indexed newPool
  );
  event DerivativeDeployed(
    uint8 indexed derivativeVersion,
    address indexed pool,
    address indexed newDerivative
  );
  event SelfMintingDerivativeDeployed(
    uint8 indexed selfMintingDerivativeVersion,
    address indexed selfMintingDerivative
  );

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles) public {
    synthereumFinder = _synthereumFinder;
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

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
    checkPoolAndDerivativeMatching(pool, derivative, true);
    setDerivativeRoles(derivative, pool, false);
    setSyntheticTokenRoles(derivative);
    ISynthereumPoolRegistry poolRegistry = getPoolRegistry();
    poolRegistry.registerPool(
      pool.syntheticTokenSymbol(),
      pool.collateralToken(),
      poolVersion,
      address(pool)
    );
    emit PoolDeployed(poolVersion, address(derivative), address(pool));
    emit DerivativeDeployed(
      derivativeVersion,
      address(pool),
      address(derivative)
    );
  }

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
    checkPoolAndDerivativeMatching(pool, derivative, true);
    setPoolRole(derivative, pool);
    ISynthereumPoolRegistry poolRegistry = getPoolRegistry();
    poolRegistry.registerPool(
      pool.syntheticTokenSymbol(),
      pool.collateralToken(),
      poolVersion,
      address(pool)
    );
    emit PoolDeployed(poolVersion, address(derivative), address(pool));
  }

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
    if (address(pool) != address(0)) {
      checkPoolAndDerivativeMatching(pool, derivative, false);
      checkPoolRegistration(pool);
      setDerivativeRoles(derivative, pool, false);
    } else {
      setDerivativeRoles(derivative, pool, true);
    }
    setSyntheticTokenRoles(derivative);
    emit DerivativeDeployed(
      derivativeVersion,
      address(pool),
      address(derivative)
    );
  }

  function deployOnlySelfMintingDerivative(
    uint8 selfMintingDerVersion,
    bytes calldata selfMintingDerParamsData
  )
    external
    override
    onlyMaintainer
    nonReentrant
    returns (ISelfMintingDerivativeDeployment selfMintingDerivative)
  {
    ISynthereumFactoryVersioning factoryVersioning = getFactoryVersioning();
    selfMintingDerivative = deploySelfMintingDerivative(
      factoryVersioning,
      selfMintingDerVersion,
      selfMintingDerParamsData
    );
    checkSelfMintingDerivativeDeployment(
      selfMintingDerivative,
      selfMintingDerVersion
    );
    address tokenCurrency = address(selfMintingDerivative.tokenCurrency());
    addSyntheticTokenRoles(tokenCurrency, address(selfMintingDerivative));
    ISelfMintingRegistry selfMintingRegistry = getSelfMintingRegistry();
    selfMintingRegistry.registerSelfMintingDerivative(
      selfMintingDerivative.syntheticTokenSymbol(),
      selfMintingDerivative.collateralCurrency(),
      selfMintingDerVersion,
      address(selfMintingDerivative)
    );
    emit SelfMintingDerivativeDeployed(
      selfMintingDerVersion,
      address(selfMintingDerivative)
    );
  }

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

  function deploySelfMintingDerivative(
    ISynthereumFactoryVersioning factoryVersioning,
    uint8 selfMintingDerVersion,
    bytes calldata selfMintingDerParamsData
  ) internal returns (ISelfMintingDerivativeDeployment selfMintingDerivative) {
    address selfMintingDerFactory =
      factoryVersioning.getSelfMintingFactoryVersion(selfMintingDerVersion);
    bytes memory selfMintingDerDeploymentResult =
      selfMintingDerFactory.functionCall(
        abi.encodePacked(
          getDeploymentSignature(selfMintingDerFactory),
          selfMintingDerParamsData
        ),
        'Wrong self-minting derivative deployment'
      );
    selfMintingDerivative = ISelfMintingDerivativeDeployment(
      abi.decode(selfMintingDerDeploymentResult, (address))
    );
  }

  function setDerivativeRoles(
    IDerivativeDeployment derivative,
    ISynthereumPoolDeployment pool,
    bool isOnlyDerivative
  ) internal {
    IRole derivativeRoles = IRole(address(derivative));
    if (!isOnlyDerivative) {
      derivativeRoles.grantRole(POOL_ROLE, address(pool));
    }
    derivativeRoles.grantRole(ADMIN_ROLE, address(getManager()));
    derivativeRoles.renounceRole(ADMIN_ROLE, address(this));
  }

  function setSyntheticTokenRoles(IDerivativeDeployment derivative) internal {
    IRole tokenCurrency = IRole(address(derivative.tokenCurrency()));
    if (
      !tokenCurrency.hasRole(MINTER_ROLE, address(derivative)) ||
      !tokenCurrency.hasRole(BURNER_ROLE, address(derivative))
    ) {
      addSyntheticTokenRoles(address(tokenCurrency), address(derivative));
    }
  }

  function addSyntheticTokenRoles(address tokenCurrency, address derivative)
    internal
  {
    ISynthereumManager manager = getManager();
    address[] memory contracts = new address[](2);
    bytes32[] memory roles = new bytes32[](2);
    address[] memory accounts = new address[](2);
    contracts[0] = tokenCurrency;
    contracts[1] = tokenCurrency;
    roles[0] = MINTER_ROLE;
    roles[1] = BURNER_ROLE;
    accounts[0] = derivative;
    accounts[1] = derivative;
    manager.grantSynthereumRole(contracts, roles, accounts);
  }

  function setPoolRole(
    IDerivativeDeployment derivative,
    ISynthereumPoolDeployment pool
  ) internal {
    ISynthereumManager manager = getManager();
    address[] memory contracts = new address[](1);
    bytes32[] memory roles = new bytes32[](1);
    address[] memory accounts = new address[](1);
    contracts[0] = address(derivative);
    roles[0] = POOL_ROLE;
    accounts[0] = address(pool);
    manager.grantSynthereumRole(contracts, roles, accounts);
  }

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

  function getPoolRegistry()
    internal
    view
    returns (ISynthereumPoolRegistry poolRegistry)
  {
    poolRegistry = ISynthereumPoolRegistry(
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.PoolRegistry
      )
    );
  }

  function getSelfMintingRegistry()
    internal
    view
    returns (ISelfMintingRegistry selfMintingRegister)
  {
    selfMintingRegister = ISelfMintingRegistry(
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.SelfMintingRegistry
      )
    );
  }

  function getManager() internal view returns (ISynthereumManager manager) {
    manager = ISynthereumManager(
      synthereumFinder.getImplementationAddress(SynthereumInterfaces.Manager)
    );
  }

  function getDeploymentSignature(address deploymentContract)
    internal
    view
    returns (bytes4 signature)
  {
    signature = IDeploymentSignature(deploymentContract).deploymentSignature();
  }

  function checkDerivativeRoles(IDerivativeDeployment derivative)
    internal
    view
  {
    address[] memory derivativeAdmins = derivative.getAdminMembers();
    require(derivativeAdmins.length == 1, 'The derivative must have one admin');
    require(
      derivativeAdmins[0] == address(this),
      'The derivative admin must be the deployer'
    );
    address[] memory derivativePools = derivative.getPoolMembers();
    require(derivativePools.length == 0, 'The derivative must have no pools');
  }

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

  function checkPoolAndDerivativeMatching(
    ISynthereumPoolDeployment pool,
    IDerivativeDeployment derivative,
    bool isPoolLinked
  ) internal view {
    require(
      pool.collateralToken() == derivative.collateralCurrency(),
      'Wrong collateral matching'
    );
    require(
      pool.syntheticToken() == derivative.tokenCurrency(),
      'Wrong synthetic token matching'
    );
    if (isPoolLinked) {
      require(
        pool.isDerivativeAdmitted(address(derivative)),
        'Pool doesnt support derivative'
      );
    }
  }

  function checkPoolRegistration(ISynthereumPoolDeployment pool) internal view {
    ISynthereumPoolRegistry poolRegistry = getPoolRegistry();
    require(
      poolRegistry.isPoolDeployed(
        pool.syntheticTokenSymbol(),
        pool.collateralToken(),
        pool.version(),
        address(pool)
      ),
      'Pool not registred'
    );
  }

  function checkSelfMintingDerivativeDeployment(
    ISelfMintingDerivativeDeployment selfMintingDerivative,
    uint8 version
  ) internal view {
    require(
      selfMintingDerivative.synthereumFinder() == synthereumFinder,
      'Wrong finder in self-minting deployment'
    );
    require(
      selfMintingDerivative.version() == version,
      'Wrong version in self-minting deployment'
    );
  }
}
