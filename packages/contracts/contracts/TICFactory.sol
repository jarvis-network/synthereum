pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {TIC} from './TIC.sol';
import {IExpiringMultiParty} from './IExpiringMultiParty.sol';
import {
  ExpiringMultiPartyCreator
} from './uma-contracts/financial-templates/expiring-multiparty/ExpiringMultiPartyCreator.sol';

contract TICFactory is Ownable, ReentrancyGuard {
  //----------------------------------------
  // State variables
  //----------------------------------------

  ExpiringMultiPartyCreator private derivativeCreator;

  // Get a TIC using its token symbol
  mapping(string => TIC) public symbolToTIC;

  //----------------------------------------
  // Constructor
  //----------------------------------------

  constructor(ExpiringMultiPartyCreator _derivativeCreator) public {
    derivativeCreator = _derivativeCreator;
  }

  //----------------------------------------
  // External functions
  //----------------------------------------

  /**
   * @notice Creates a new TIC
   * @param params The parameters used to create the underlying derivative
   * @param liquidityProvider The liquidity provider
   * @param validator The address that validates mint and exchange requests
   * @param startingCollateralization Collateralization ratio to use before a global one is set
   * @param fee The fee structure
   */
  function createTIC(
    ExpiringMultiPartyCreator.Params calldata params,
    address liquidityProvider,
    address validator,
    uint256 startingCollateralization,
    TIC.Fee calldata fee
  ) external onlyOwner nonReentrant {
    // Create the derivative contract
    // TODO: `ExpiringMultiPartyCreator` past commit b6dc123e11d7253cdbe0fcc40b7ab4a992c4e56d
    //       requires `minSponsorTokens` param.
    address derivative = derivativeCreator.createExpiringMultiParty(params);
    //Require TIC does not exist
    require(
      address(symbolToTIC[params.syntheticSymbol]) == address(0),
      'TIC already exists'
    );
    // Create the TIC
    symbolToTIC[params.syntheticSymbol] = new TIC(
      IExpiringMultiParty(derivative),
      liquidityProvider,
      validator,
      startingCollateralization,
      fee
    );
  }
}
