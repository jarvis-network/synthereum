pragma solidity >=0.5.14 <0.7.0;
pragma experimental ABIEncoderV2;

import {TokenizedDerivativeCreator as TDC} from "protocol/core/contracts/TokenizedDerivativeCreator.sol";

/**
 * Pass through contract used to generate an artifact file for Truffle.
 *
 * Without an artifact file, the TokenizedDerivativeCreator could not be used
 * by migration scripts.
 */
contract TokenizedDerivativeCreator is TDC {}
