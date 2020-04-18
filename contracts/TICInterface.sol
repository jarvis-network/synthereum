pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {FixedPoint} from "protocol/core/contracts/common/implementation/FixedPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ExpiringMultiParty} from "protocol/core/contracts/financial-templates/implementation/ExpiringMultiParty.sol";

/**
 * @title Token Issuer Contract Interface
 */
interface TICInterface {
    //----------------------------------------
    // External functions
    //----------------------------------------

    function mint(
        FixedPoint.Unsigned calldata collateralAmount,
        FixedPoint.Unsigned calldata numTokens
    ) external;

    function deposit(FixedPoint.Unsigned calldata collateralAmount) external;

    function exchangeMint(
        FixedPoint.Unsigned calldata collateralAmount,
        FixedPoint.Unsigned calldata numTokens
    ) external;

    function withdrawRequest(FixedPoint.Unsigned calldata collateralAmount) external;

    function withdrawPassedRequest() external;

    function settleExpired() external;

    function exchange(
        TICInterface destTIC,
        FixedPoint.Unsigned calldata numTokens,
        FixedPoint.Unsigned calldata destNumTokens
    ) external;

    //----------------------------------------
    // External views
    //----------------------------------------

    function derivative() external view returns (ExpiringMultiParty);

    function collateralToken() external view returns (IERC20);

    function syntheticToken() external view  returns (IERC20);
}
