// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {ICreditLineController} from './interfaces/ICreditLineController.sol';
import {
  ISynthereumRegistry
} from '../../../core/registries/interfaces/IRegistry.sol';
import {
  ICreditLineDerivativeDeployment
} from './interfaces/ICreditLineDerivativeDeployment.sol';
import {
  ISynthereumFactoryVersioning
} from '../../../core/interfaces/IFactoryVersioning.sol';
import {ICreditLineStorage} from './interfaces/ICreditLineStorage.sol';
import {
  SynthereumInterfaces,
  FactoryInterfaces
} from '../../../core/Constants.sol';
import {
  FixedPoint
} from '@uma/core/contracts/common/implementation/FixedPoint.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

/**
 * @title SelfMintingController
 * Set capMintAmount, and fee recipient, proportions and percentage of each self-minting derivative
 */

contract CreditLineController is
  ICreditLineController,
  AccessControlEnumerable
{
  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //Describe role structure
  struct Roles {
    address admin;
    address maintainers;
  }

  //----------------------------------------
  // Storage
  //----------------------------------------

  ISynthereumFinder public synthereumFinder;

  mapping(address => uint256) private capMint;

  mapping(address => ICreditLineStorage.Fee) private fee;

  //----------------------------------------
  // Events
  //----------------------------------------

  event SetCapMintAmount(
    address indexed selfMintingDerivative,
    uint256 capMintAmount
  );

  event SetFeePercentage(
    address indexed selfMintingDerivative,
    uint256 feePercentage
  );

  event SetFeeRecipients(
    address indexed selfMintingDerivative,
    address[] feeRecipient
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

  modifier onlyMaintainerOrSelfMintingFactory() {
    if (hasRole(MAINTAINER_ROLE, msg.sender)) {
      _;
    } else {
      ISynthereumFactoryVersioning factoryVersioning =
        ISynthereumFactoryVersioning(
          synthereumFinder.getImplementationAddress(
            SynthereumInterfaces.FactoryVersioning
          )
        );
      uint256 numberOfFactories =
        factoryVersioning.numberOfVerisonsOfFactory(
          FactoryInterfaces.SelfMintingFactory
        );
      uint256 counter = 0;
      for (uint8 i = 0; counter < numberOfFactories; i++) {
        try
          factoryVersioning.getFactoryVersion(
            FactoryInterfaces.SelfMintingFactory,
            i
          )
        returns (address factory) {
          if (msg.sender == factory) {
            _;
            break;
          } else {
            counter++;
          }
        } catch {}
      }
      if (numberOfFactories == counter) {
        revert('Sender must be the maintainer or a self-minting factory');
      }
    }
  }

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs the SynthereumManager contract
   * @param _synthereumFinder Synthereum finder contract
   * @param _roles Admin and maintainer roles
   */
  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles) {
    synthereumFinder = _synthereumFinder;
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainers);
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Allow to set capMintAmount on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param capMintAmounts Mint cap amounts for self-minting derivatives
   */
  function setCapMintAmount(
    address[] calldata selfMintingDerivatives,
    uint256[] calldata capMintAmounts
  ) external override onlyMaintainerOrSelfMintingFactory {
    require(
      selfMintingDerivatives.length > 0,
      'No self-minting derivatives passed'
    );
    require(
      selfMintingDerivatives.length == capMintAmounts.length,
      'Number of derivatives and mint cap amounts must be the same'
    );
    require(hasRole(MAINTAINER_ROLE), msg.sender);
    for (uint256 j; j < selfMintingDerivatives.length; j++) {
      ICreditLineDerivativeDeployment creditLineDerivative =
        ICreditLineDerivativeDeployment(selfMintingDerivatives[j]);

      checkSelfMintingDerivativeRegistration(creditLineDerivative);
      _setCapMintAmount(address(creditLineDerivative), capMintAmounts[j]);
    }
  }

  /**
   * @notice Allow to set  fee percentages on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param feePercentages fee percentages for self-minting derivatives
   */
  function setFeePercentage(
    address[] calldata selfMintingDerivatives,
    FixedPoint.Unsigned[] calldata feePercentages
  ) external override onlyMaintainer {
    uint256 selfMintingDerCount = selfMintingDerivatives.length;
    require(selfMintingDerCount > 0, 'No self-minting derivatives passed');
    require(
      selfMintingDerCount == feePercentages.length,
      'Number of derivatives and  fee percentages must be the same'
    );
    for (uint256 j; j < selfMintingDerCount; j++) {
      ICreditLineDerivativeDeployment selfMintingDerivative =
        ICreditLineDerivativeDeployment(selfMintingDerivatives[j]);
      checkSelfMintingDerivativeRegistration(selfMintingDerivative);
      _setFeePercentage(address(selfMintingDerivative), feePercentages[j]);
    }
  }

  /**
   * @notice Internal helper function for setFeePercentage function
   */
  function _setFeePercentage(
    address selfMintingDerivative,
    FixedPoint.Unsigned calldata feePercentage
  ) internal {
    require(
      fee[selfMintingDerivative].feePercentage != feePercentage,
      ' fee percentage is the same'
    );
    fee[selfMintingDerivative].feePercentage = feePercentage;
    emit SetFeePercentage(selfMintingDerivative, feePercentage);
  }

  /**
   * @notice Internal helper function for setCapMintAmount function
   */
  function _setCapMintAmount(
    address selfMintingDerivative,
    uint256 capMintAmount
  ) internal {
    require(
      capMint[selfMintingDerivative] != capMintAmount,
      'Cap mint amount is the same'
    );
    capMint[selfMintingDerivative] = capMintAmount;
    emit SetCapMintAmount(selfMintingDerivative, capMintAmount);
  }

  /**
   * @notice Check if a self-minting derivative is registered with the SelfMintingRegistry
   * @param selfMintingDerivative Self-minting derivative contract
   */
  function checkSelfMintingDerivativeRegistration(
    ICreditLineDerivativeDeployment selfMintingDerivative
  ) internal view {
    ISynthereumRegistry selfMintingRegistry =
      ISynthereumRegistry(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.SelfMintingRegistry
        )
      );
    require(
      selfMintingRegistry.isDeployed(
        selfMintingDerivative.syntheticTokenSymbol(),
        selfMintingDerivative.collateralCurrency(),
        selfMintingDerivative.version(),
        address(selfMintingDerivative)
      ),
      'Self-minting derivative not registred'
    );
  }
}
