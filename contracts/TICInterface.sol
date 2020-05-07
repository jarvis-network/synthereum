pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {FixedPoint} from "./uma-contracts/common/implementation/FixedPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ExpiringMultiParty} from "./uma-contracts/financial-templates/implementation/ExpiringMultiParty.sol";

/**
 * @title Token Issuer Contract Interface
 */
interface TICInterface {
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

    struct MintRequest {
        bytes32 mintID;
        uint256 timestamp;
        address sender;
        FixedPoint.Unsigned collateralAmount;
        FixedPoint.Unsigned numTokens;
    }

    //----------------------------------------
    // External functions
    //----------------------------------------

    function mintRequest(uint256 collateralAmount, uint256 numTokens) external;

    function approveMint(bytes32 mintID) external;

    function rejectMint(bytes32 mintID) external;

    function deposit(uint256 collateralAmount) external;

    function exchangeMint(uint256 collateralAmount, uint256 numTokens) external;

    function withdrawRequest(uint256 collateralAmount) external;

    function withdrawPassedRequest() external;

    function settleExpired() external;

    function exchange(TICInterface destTIC, uint256 numTokens, uint256 destNumTokens) external;

    //----------------------------------------
    // External views
    //----------------------------------------

    function derivative() external view returns (ExpiringMultiParty);

    function collateralToken() external view returns (IERC20);

    function syntheticToken() external view returns (IERC20);

    function calculateMintFee(uint256 collateralAmount) external view returns (uint256);

    function getMintRequests() external view returns (MintRequest[] memory);
}
