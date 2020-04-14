pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {FixedPoint} from "protocol/core/contracts/common/implementation/FixedPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ExpiringMultiParty} from "protocol/core/contracts/financial-templates/implementation/ExpiringMultiParty.sol";

/**
 * @title Token Issuer Contract Interface
 * @dev Necessary for use with the `TICFactory`. Attempting to import the full `TIC` into the
 *      `TICFactory` exceeds gas limits when deploying the `TICFactory`.
 */
contract TICInterface {
    //----------------------------------------
    // Type definitions
    //----------------------------------------

    using FixedPoint for FixedPoint.Unsigned;

    // Describe fee structure
    struct Fee {
        // Fees charged when a user mints tokens
        FixedPoint.Unsigned mintFee;
        address[] mintFeeRecipients;
        uint32[] mintFeeProportions;

        // Fees taken from the interest accrued by collateral
        address[] interestFeeRecipients;
        uint32[] interestFeeProportions;
    }

    //----------------------------------------
    // External functions
    //----------------------------------------

    function mint(
        FixedPoint.Unsigned calldata collateralAmount,
        FixedPoint.Unsigned calldata numTokens
    ) external virtual {}

    function deposit(FixedPoint.Unsigned calldata collateralAmount) external virtual {}

    function exchangeMint(
        FixedPoint.Unsigned calldata collateralAmount,
        FixedPoint.Unsigned calldata numTokens
    ) external virtual {}

    function withdrawRequest(FixedPoint.Unsigned calldata collateralAmount) external virtual {}

    function withdrawPassedRequest() external virtual {}

    function settleExpired() external virtual {}

    function exchange(
        TICInterface destTIC,
        FixedPoint.Unsigned calldata numTokens,
        FixedPoint.Unsigned calldata destNumTokens
    ) external virtual {}

    //----------------------------------------
    // External views
    //----------------------------------------

    function collateralToken() external view virtual returns (IERC20) {}

    //----------------------------------------
    // Public functions
    //----------------------------------------

    function initialize(
        ExpiringMultiParty _derivative,
        address _liquidityProvider,
        Fee memory _fee
    ) public virtual {}
}
