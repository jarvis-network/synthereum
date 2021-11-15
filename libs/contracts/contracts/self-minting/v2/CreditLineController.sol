// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {ICreditLineController} from './interfaces/ICreditLineController.sol';
import {
  ISynthereumRegistry
} from '../../core/registries/interfaces/IRegistry.sol';
import {ICreditLine} from './interfaces/ICreditLine.sol';
import {
  ISynthereumFactoryVersioning
} from '../../core/interfaces/IFactoryVersioning.sol';
import {ICreditLineStorage} from './interfaces/ICreditLineStorage.sol';
import {
  SynthereumInterfaces,
  FactoryInterfaces
} from '../../core/Constants.sol';
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
  using FixedPoint for FixedPoint.Unsigned;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //Describe role structure
  struct Roles {
    address admin;
    address[] maintainers;
  }

  //----------------------------------------
  // Storage
  //----------------------------------------

  ISynthereumFinder public synthereumFinder;

  mapping(address => uint256) private capMint;

  mapping(address => FixedPoint.Unsigned) private liquidationReward;

  mapping(address => FixedPoint.Unsigned) private collateralRequirement;

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
    address[] feeRecipient,
    uint32[] feeProportions
  );

  event SetLiquidationReward(
    address indexed selfMintingDerivative,
    uint256 liquidationReward
  );

  event SetCollateralRequirement(
    address indexed selfMintingDerivative,
    uint256 collateralRequirement
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

  // TODO
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
    for (uint256 i = 0; i < _roles.maintainers.length; i++) {
      _setupRole(MAINTAINER_ROLE, _roles.maintainers[i]);
    }
  }

  //----------------------------------------
  // External functions
  //----------------------------------------
  function setCollateralRequirement(
    address[] calldata selfMintingDerivatives,
    uint256[] calldata collateralRequirements
  ) external override onlyMaintainerOrSelfMintingFactory {
    require(
      selfMintingDerivatives.length > 0,
      'No self-minting derivatives passed'
    );
    require(
      selfMintingDerivatives.length == collateralRequirements.length,
      'Number of derivatives and overcollaterals must be the same'
    );
    bool isMaintainer = hasRole(MAINTAINER_ROLE, msg.sender);
    for (uint256 j; j < selfMintingDerivatives.length; j++) {
      if (isMaintainer) {
        checkSelfMintingDerivativeRegistration(
          ICreditLine(selfMintingDerivatives[j])
        );
      }
      _setCollateralRequirement(
        selfMintingDerivatives[j],
        collateralRequirements[j]
      );
    }
  }

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
    bool isMaintainer = hasRole(MAINTAINER_ROLE, msg.sender);
    for (uint256 j; j < selfMintingDerivatives.length; j++) {
      ICreditLine creditLineDerivative = ICreditLine(selfMintingDerivatives[j]);
      if (isMaintainer) {
        checkSelfMintingDerivativeRegistration(creditLineDerivative);
      }
      _setCapMintAmount(address(creditLineDerivative), capMintAmounts[j]);
    }
  }

  function setFeePercentage(
    address[] calldata selfMintingDerivatives,
    FixedPoint.Unsigned[] calldata feePercentages
  ) external override onlyMaintainerOrSelfMintingFactory {
    uint256 selfMintingDerCount = selfMintingDerivatives.length;
    require(selfMintingDerCount > 0, 'No self-minting derivatives passed');
    require(
      selfMintingDerCount == feePercentages.length,
      'Number of derivatives and  fee percentages must be the same'
    );
    bool isMaintainer = hasRole(MAINTAINER_ROLE, msg.sender);
    for (uint256 j; j < selfMintingDerCount; j++) {
      ICreditLine selfMintingDerivative =
        ICreditLine(selfMintingDerivatives[j]);
      if (isMaintainer) {
        checkSelfMintingDerivativeRegistration(selfMintingDerivative);
      }
      _setFeePercentage(address(selfMintingDerivative), feePercentages[j]);
    }
  }

  function setFeeRecipients(
    address[] calldata selfMintingDerivatives,
    address[][] calldata feeRecipients,
    uint32[][] calldata feeProportions
  ) external override onlyMaintainerOrSelfMintingFactory {
    require(
      selfMintingDerivatives.length == feeRecipients.length,
      'Mismatch between derivatives to update and fee recipients'
    );
    require(
      selfMintingDerivatives.length == feeProportions.length,
      'Mismatch between derivatives to update and fee proportions'
    );
    bool isMaintainer = hasRole(MAINTAINER_ROLE, msg.sender);
    // update each derivative fee parameters
    for (uint256 j; j < selfMintingDerivatives.length; j++) {
      if (isMaintainer) {
        checkSelfMintingDerivativeRegistration(
          ICreditLine(selfMintingDerivatives[j])
        );
      }
      _setFeeRecipients(
        selfMintingDerivatives[j],
        feeRecipients[j],
        feeProportions[j]
      );
      emit SetFeeRecipients(
        selfMintingDerivatives[j],
        feeRecipients[j],
        feeProportions[j]
      );
    }
  }

  function setLiquidationRewardPercentage(
    address[] calldata selfMintingDerivatives,
    FixedPoint.Unsigned[] calldata _liquidationRewards
  ) external override onlyMaintainerOrSelfMintingFactory {
    bool isMaintainer = hasRole(MAINTAINER_ROLE, msg.sender);
    for (uint256 j; j < selfMintingDerivatives.length; j++) {
      if (isMaintainer) {
        checkSelfMintingDerivativeRegistration(
          ICreditLine(selfMintingDerivatives[j])
        );
      }
      require(
        _liquidationRewards[j].isGreaterThan(0) &&
          _liquidationRewards[j].isLessThanOrEqual(
            FixedPoint.fromUnscaledUint(1)
          ),
        'Liquidation reward must be between 0 and 100%'
      );

      liquidationReward[selfMintingDerivatives[j]] = _liquidationRewards[j];
      emit SetLiquidationReward(
        selfMintingDerivatives[j],
        _liquidationRewards[j].rawValue
      );
    }
  }

  function getCollateralRequirement(address selfMintingDerivative)
    external
    view
    override
    returns (uint256)
  {
    return collateralRequirement[selfMintingDerivative].rawValue;
  }

  function getLiquidationRewardPercentage(address selfMintingDerivative)
    external
    view
    override
    returns (uint256)
  {
    return liquidationReward[selfMintingDerivative].rawValue;
  }

  function getFeeInfo(address selfMintingDerivative)
    external
    view
    override
    returns (ICreditLineStorage.Fee memory)
  {
    return fee[selfMintingDerivative];
  }

  function getCapMintAmount(address selfMintingDerivative)
    external
    view
    override
    returns (uint256 capMintAmount)
  {
    return capMint[selfMintingDerivative];
  }

  //----------------------------------------
  // Internal functions
  //----------------------------------------

  function _setCollateralRequirement(
    address selfMintingDerivative,
    uint256 percentage
  ) internal {
    require(
      percentage > 10**18,
      'Overcollateralisation must be bigger than 100%'
    );
    collateralRequirement[selfMintingDerivative] = FixedPoint.Unsigned(
      percentage
    );
    emit SetCollateralRequirement(selfMintingDerivative, percentage);
  }

  function _setFeeRecipients(
    address selfMintingDerivative,
    address[] calldata feeRecipients,
    uint32[] calldata feeProportions
  ) internal {
    uint256 totalActualFeeProportions = 0;

    // Store the sum of all proportions
    for (uint256 i = 0; i < feeProportions.length; i++) {
      totalActualFeeProportions += feeProportions[i];

      fee[selfMintingDerivative].feeRecipients = feeRecipients;
      fee[selfMintingDerivative].feeProportions = feeProportions;
      fee[selfMintingDerivative]
        .totalFeeProportions = totalActualFeeProportions;
    }
  }

  function _setFeePercentage(
    address selfMintingDerivative,
    FixedPoint.Unsigned calldata feePercentage
  ) internal {
    require(
      fee[selfMintingDerivative].feePercentage.rawValue !=
        feePercentage.rawValue,
      ' fee percentage is the same'
    );
    fee[selfMintingDerivative].feePercentage = feePercentage;
    emit SetFeePercentage(selfMintingDerivative, feePercentage.rawValue);
  }

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
    ICreditLine selfMintingDerivative
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
        selfMintingDerivative.collateralToken(),
        selfMintingDerivative.version(),
        address(selfMintingDerivative)
      ),
      'Self-minting derivative not registred'
    );
  }
}
