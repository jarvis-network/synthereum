pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {TICInterface} from "./TICInterface.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {FixedPoint} from "protocol/core/contracts/common/implementation/FixedPoint.sol";
import {TICHelper} from "./TICHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRToken} from "./IRToken.sol";
import {ExpiringMultiParty} from "protocol/core/contracts/financial-templates/implementation/ExpiringMultiParty.sol";

/**
 * @title Token Issuer Contract
 * @notice Collects margin, issues synthetic assets, and distributes accrued interest
 * @dev Collateral is wrapped by an `RToken` to accrue and distribute interest before being sent
 *      to the `ExpiringMultiParty` contract.
 */
contract TIC is TICInterface, ReentrancyGuard {
    //----------------------------------------
    // Type definitions
    //----------------------------------------

    using SafeMath for uint256;
    using FixedPoint for FixedPoint.Unsigned;
    using TICHelper for Storage;

    struct Storage {
        ExpiringMultiParty derivative;
        FixedPoint.Unsigned startingCollateralization;
        address liquidityProvider;
        IRToken rtoken;
        uint256 hatID;
        Fee fee;

        // Used with individual proportions to scale values
        uint256 totalMintFeeProportions;
    }

    //----------------------------------------
    // State variables
    //----------------------------------------

    Storage private ticStorage;

    //----------------------------------------
    // Constructor
    //----------------------------------------

    /**
     * @dev Margin currency must be a RToken
     * @dev `_startingCollateralization should be greater than the expected asset price multiplied
     *      by the collateral requirement. The degree to which it is greater should be based on
     *      the expected asset volatility.
     * @param _derivative The `ExpiringMultiParty`
     * @param _liquidityProvider The liquidity provider
     * @param _startingCollateralization Collateralization ratio to use before a global one is set
     * @param _fee The fee structure
     */
    constructor (
        ExpiringMultiParty _derivative,
        address _liquidityProvider,
        uint256 _startingCollateralization,
        Fee memory _fee
    ) public nonReentrant {
        ticStorage.initialize(
            _derivative,
            _liquidityProvider,
            FixedPoint.Unsigned(_startingCollateralization),
            _fee
        );
    }

    //----------------------------------------
    // Modifiers
    //----------------------------------------

    modifier onlyLiquidityProvider() {
        require(msg.sender == ticStorage.liquidityProvider, 'Must be liquidity provider');
        _;
    }

    //----------------------------------------
    // External functions
    //----------------------------------------

    /**
     * @notice User supplies collateral to the TIC and receives synthetic assets
     * @notice Requires authorization to transfer the collateral tokens
     * @param collateralAmount The amount of collateral supplied
     * @param numTokens The number of tokens the user wants to mint
     */
    function mint(uint256 collateralAmount, uint256 numTokens) external override {
        ticStorage.mint(FixedPoint.Unsigned(collateralAmount), FixedPoint.Unsigned(numTokens));
    }

    /**
     * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
     * @param collateralAmount The amount of margin supplied
     */
    function deposit(uint256 collateralAmount) external override onlyLiquidityProvider {
        ticStorage.deposit(FixedPoint.Unsigned(collateralAmount));
    }

    /**
     * TODO: Potentially restrict this function to only TICs registered on a whitelist
     * @notice Called by a source TIC's `exchange` function to mint destination tokens
     * @dev This function could be called by any account to mint tokens, however they will lose
     *      their excess collateral to the liquidity provider when they redeem the tokens.
     * @param collateralAmount The amount of collateral to use from the source TIC
     * @param numTokens The number of new tokens to mint
     */
    function exchangeMint(uint256 collateralAmount, uint256 numTokens) external override {
        ticStorage.exchangeMint(
            FixedPoint.Unsigned(collateralAmount),
            FixedPoint.Unsigned(numTokens)
        );
    }

    /**
     * @notice Start a withdrawal request
     * @notice Collateral can be withdrawn once the liveness period has elapsed
     * @param collateralAmount The amount of short margin to withdraw
     */
    function withdrawRequest(uint256 collateralAmount)
        external
        override
        onlyLiquidityProvider
        nonReentrant
    {
        ticStorage.withdrawRequest(FixedPoint.Unsigned(collateralAmount));
    }

    /**
     * @notice Withdraw collateral after a withdraw request has passed it's liveness period
     */
    function withdrawPassedRequest() external override onlyLiquidityProvider nonReentrant {
        ticStorage.withdrawPassedRequest();
    }

    /**
     * @notice Redeem tokens after contract expiry
     * @notice After derivative expiry, an LP should use this instead of `withdrawRequest` to
     *         retrieve their collateral.
     */
    function settleExpired() external override nonReentrant {
        ticStorage.settleExpired();
    }

    /**
     * @notice Perform an atomic of tokens between this TIC and the destination TIC
     * @dev The number of destination tokens needs to be calculated relative to the value of the
     *      source tokens and the destination's collateral ratio. If too many destination tokens
     *      are requested the transaction will fail.
     * @param destTIC The destination TIC
     * @param numTokens The number of source tokens to swap
     * @param destNumTokens The number of destination tokens the swap attempts to procure
     */
    function exchange(TICInterface destTIC, uint256 numTokens, uint256 destNumTokens)
        external
        override
        nonReentrant
    {
        ticStorage.exchange(
            destTIC,
            FixedPoint.Unsigned(numTokens),
            FixedPoint.Unsigned(destNumTokens)
        );
    }

    //----------------------------------------
    // External views
    //----------------------------------------

    /**
     * @notice Get the derivative contract
     * @return The `ExpiringMultiParty` derivative contract
     */
    function derivative() external view override returns (ExpiringMultiParty) {
        return ticStorage.derivative;
    }

    /**
     * @notice Get the collateral token
     * @return The ERC20 collateral token
     */
    function collateralToken() external view override returns (IERC20) {
        return ticStorage.rtoken.token();
    }

    /**
     * @notice Get the synthetic token from the derivative contract
     * @return The ERC20 synthetic token
     */
    function syntheticToken() external view override returns (IERC20) {
        return ticStorage.derivative.tokenCurrency();
    }
}
