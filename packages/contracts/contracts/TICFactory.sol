pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {TIC} from './TIC.sol';
import {IExpiringMultiParty} from './IExpiringMultiParty.sol';
import {
  ExpiringMultiPartyCreator
} from '@jarvis-network/uma-core/contracts/financial-templates/expiring-multiparty/ExpiringMultiPartyCreator.sol';

contract TICFactory is AccessControl, ReentrancyGuard {
  //----------------------------------------
  // Constants
  //----------------------------------------

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  //----------------------------------------
  // Struct
  //----------------------------------------

  struct Roles {
    address admin;
    address maintainer;
  }

  //----------------------------------------
  // State variables
  //----------------------------------------

  ExpiringMultiPartyCreator private derivativeCreator;

  // Get a TIC using its token symbol
  mapping(string => TIC) public symbolToTIC;

  //----------------------------------------
  // Constructor
  //----------------------------------------

  constructor(Roles memory _roles, ExpiringMultiPartyCreator _derivativeCreator)
    public
  {
    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
    derivativeCreator = _derivativeCreator;
  }

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
  // External functions
  //----------------------------------------

  /**
   * @notice Creates a new TIC
   * @param params The parameters used to create the underlying derivative
   * @param startingCollateralization Collateralization ratio to use before a global one is set
   * @param roles The addresses of admin, maintainer, liquidity provider and validator
   * @param fee The fee structure
   */
  function createTIC(
    ExpiringMultiPartyCreator.Params calldata params,
    uint256 startingCollateralization,
    TIC.Roles calldata roles,
    TIC.Fee calldata fee
  ) external onlyMaintainer nonReentrant {
    //Require TIC does not exist
    require(
      address(symbolToTIC[params.syntheticSymbol]) == address(0),
      'TIC already exists'
    );
    // Create the derivative contract
    // TODO: `ExpiringMultiPartyCreator` past commit b6dc123e11d7253cdbe0fcc40b7ab4a992c4e56d
    //       requires `minSponsorTokens` param.
    address derivative = derivativeCreator.createExpiringMultiParty(params);
    // Create the TIC
    symbolToTIC[params.syntheticSymbol] = new TIC(
      IExpiringMultiParty(derivative),
      roles,
      startingCollateralization,
      fee
    );
  }
}
