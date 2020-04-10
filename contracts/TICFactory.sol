pragma solidity ^0.6.0;

pragma experimental ABIEncoderV2;

import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {TIC} from "./TIC.sol";
import {ExpiringMultiPartyCreator} from "protocol/core/contracts/financial-templates/implementation/ExpiringMultiPartyCreator.sol";

contract TICFactory is Ownable {
    ExpiringMultiPartyCreator private derivativeCreator;

    // Get a TIC using its token symbol
    mapping(string => TIC) public symbolToTIC;

    constructor(ExpiringMultiPartyCreator _derivativeCreator) public {
        derivativeCreator = _derivativeCreator;
    }

    /**
     * @notice Creates a new TIC
     * @param params The parameters used to create the underlying derivative
     * @param liquidityProvider The LP for the TIC
     */
    function createTIC(
        ExpiringMultiPartyCreator.Params calldata params,
        address liquidityProvider
    )
        external
        onlyOwner
    {
        symbolToTIC[params.syntheticSymbol] = new TIC(
            derivativeCreator,
            params,
            liquidityProvider
        );
    }
}
