// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {ISelfMintingController} from './interfaces/ISelfMintingController.sol';
import {ISelfMintingRegistry} from './interfaces/ISelfMintingRegistry.sol';
import {
  ISelfMinting
} from '../derivative/self-minting/common/interfaces/ISelfMinting.sol';
import {SynthereumInterfaces} from './Constants.sol';
import {
  FixedPoint
} from '../../@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {
  AccessControl
} from '../../@openzeppelin/contracts/access/AccessControl.sol';

contract SelfMintingController is ISelfMintingController, AccessControl {
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
   * @notice Constructs the SynthereumManager contract
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
   * @notice Allow to set capMintAmount on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param capMintAmounts Mint cap amounts for self-minting derivatives
   */
  function setCapMintAmount(
    address[] calldata selfMintingDerivatives,
    uint256[] calldata capMintAmounts
  ) external override onlyMaintainer {
    uint256 selfMintingDerCount = selfMintingDerivatives.length;
    require(selfMintingDerCount > 0, 'No self-minting derivatives passed');
    require(
      selfMintingDerCount == capMintAmounts.length,
      'Number of derivatives and mint cap amounts must be the same'
    );
    for (uint256 j; j < selfMintingDerCount; j++) {
      ISelfMinting selfMintingDerivative =
        ISelfMinting(selfMintingDerivatives[j]);
      checkSelfMintingDerivativeRegistration(selfMintingDerivative);
      selfMintingDerivative.setCapMintAmount(
        FixedPoint.Unsigned(capMintAmounts[j])
      );
    }
  }

  /**
   * @notice Allow to set capDepositRatio on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param capDepositRatios Deposit caps ratios for self-minting derivatives
   */
  function setCapDepositRatio(
    address[] calldata selfMintingDerivatives,
    uint256[] calldata capDepositRatios
  ) external override onlyMaintainer {
    uint256 selfMintingDerCount = selfMintingDerivatives.length;
    require(selfMintingDerCount > 0, 'No self-minting derivatives passed');
    require(
      selfMintingDerCount == capDepositRatios.length,
      'Number of derivatives and deposit cap ratios must be the same'
    );
    for (uint256 j; j < selfMintingDerCount; j++) {
      ISelfMinting selfMintingDerivative =
        ISelfMinting(selfMintingDerivatives[j]);
      checkSelfMintingDerivativeRegistration(selfMintingDerivative);
      selfMintingDerivative.setCapDepositRatio(
        FixedPoint.Unsigned(capDepositRatios[j])
      );
    }
  }

  /**
   * @notice Allow to set Dao fees on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param daoFees Dao fees for self-minting derivatives
   */
  function setDaoFee(
    address[] calldata selfMintingDerivatives,
    ISelfMinting.DaoFee[] calldata daoFees
  ) external override onlyMaintainer {
    uint256 selfMintingDerCount = selfMintingDerivatives.length;
    require(selfMintingDerCount > 0, 'No self-minting derivatives passed');
    require(
      selfMintingDerCount == daoFees.length,
      'Number of derivatives and dao fees must be the same'
    );
    for (uint256 j; j < selfMintingDerCount; j++) {
      ISelfMinting selfMintingDerivative =
        ISelfMinting(selfMintingDerivatives[j]);
      checkSelfMintingDerivativeRegistration(selfMintingDerivative);
      selfMintingDerivative.setDaoFee(daoFees[j]);
    }
  }

  /**
   * @notice Allow to set Dao fee percentages on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param daoFeePercentages Dao fee percentages for self-minting derivatives
   */
  function setDaoFeePercentage(
    address[] calldata selfMintingDerivatives,
    uint256[] calldata daoFeePercentages
  ) external override onlyMaintainer {
    uint256 selfMintingDerCount = selfMintingDerivatives.length;
    require(selfMintingDerCount > 0, 'No self-minting derivatives passed');
    require(
      selfMintingDerCount == daoFeePercentages.length,
      'Number of derivatives and dao fee percentages must be the same'
    );
    for (uint256 j; j < selfMintingDerCount; j++) {
      ISelfMinting selfMintingDerivative =
        ISelfMinting(selfMintingDerivatives[j]);
      checkSelfMintingDerivativeRegistration(selfMintingDerivative);
      selfMintingDerivative.setDaoFeePercentage(
        FixedPoint.Unsigned(daoFeePercentages[j])
      );
    }
  }

  /**
   * @notice Allow to set Dao fee recipients on a list of registered self-minting derivatives
   * @param selfMintingDerivatives Self-minting derivatives
   * @param daoFeeRecipients Dao fee recipients for self-minting derivatives
   */
  function setDaoFeeRecipient(
    address[] calldata selfMintingDerivatives,
    address[] calldata daoFeeRecipients
  ) external override onlyMaintainer {
    uint256 selfMintingDerCount = selfMintingDerivatives.length;
    require(selfMintingDerCount > 0, 'No self-minting derivatives passed');
    require(
      selfMintingDerCount == daoFeeRecipients.length,
      'Number of derivatives and dao fee recipients must be the same'
    );
    for (uint256 j; j < selfMintingDerCount; j++) {
      ISelfMinting selfMintingDerivative =
        ISelfMinting(selfMintingDerivatives[j]);
      checkSelfMintingDerivativeRegistration(selfMintingDerivative);
      selfMintingDerivative.setDaoFeeRecipient(daoFeeRecipients[j]);
    }
  }

  function checkSelfMintingDerivativeRegistration(
    ISelfMinting selfMintingDerivative
  ) internal view {
    ISelfMintingRegistry selfMintingRegistry =
      ISelfMintingRegistry(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.SelfMintingRegistry
        )
      );
    require(
      selfMintingRegistry.isSelfMintingDerivativeDeployed(
        selfMintingDerivative.syntheticTokenSymbol(),
        selfMintingDerivative.collateralToken(),
        selfMintingDerivative.version(),
        address(selfMintingDerivative)
      ),
      'Self-minting derivative not registred'
    );
  }
}
