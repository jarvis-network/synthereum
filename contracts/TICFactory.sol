pragma solidity ^0.6.0;

pragma experimental ABIEncoderV2;

import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {TIC} from "./TIC.sol";
import {TokenizedDerivativeCreator} from "protocol/core/contracts/tokenized-derivative/TokenizedDerivativeCreator.sol";

contract TICFactory is Ownable {
    TokenizedDerivativeCreator private derivativeCreator;

    // Get a TIC using its token symbol
    mapping(string => TIC) public symbolToTIC;

    constructor(TokenizedDerivativeCreator _derivativeCreator) public {
        derivativeCreator = _derivativeCreator;
    }

    /**
     * @notice Creates a new TIC
     * @param params The parameters used to create the underlying derivative
     * @param liquidityProvider The LP for the TIC
     */
    function createTIC(
        TokenizedDerivativeCreator.Params calldata params,
        address liquidityProvider
    )
        external
        onlyOwner
    {
        symbolToTIC[params.symbol] = new TIC(
            derivativeCreator,
            params,
            liquidityProvider,
            owner()
        );
    }
}
