pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {FixedPoint} from "protocol/core/contracts/common/implementation/FixedPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRToken} from "./IRToken.sol";
import {ExpiringMultiParty} from "protocol/core/contracts/financial-templates/implementation/ExpiringMultiParty.sol";
import {ExpiringMultiPartyCreator} from "protocol/core/contracts/financial-templates/implementation/ExpiringMultiPartyCreator.sol";

/**
 * @title Token Issuer Contract
 * @notice Collects margin, issues synthetic assets, and distributes accrued interest
 * @dev Collateral is wrapped by an `RToken` to accrue and distribute interest before being sent
 *      to the `ExpiringMultiParty` contract
 */
contract TIC is ReentrancyGuard {
    //----------------------------------------
    // Type definitions
    //----------------------------------------

    using SafeMath for uint256;
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
    // State variables
    //----------------------------------------

    ExpiringMultiParty public derivative;
    address private liquidityProvider;
    IRToken public rtoken;
    uint256 private hatID;
    Fee public fee;
    // Used with individual proportions to scale values
    uint256 private totalMintFeeProportions;

    //----------------------------------------
    // Constructor
    //----------------------------------------

    /**
     * @notice Margin currency must be a rtoken
     * @dev TIC creates a new derivative so it is set as the sponsor
     * @param derivativeCreator The `ExpiringMultiPartyCreator`
     * @param params The `ExpiringMultiParty` parameters
     * @param _liquidityProvider The liquidity provider
     * @param _fee The fee structure
     */
    constructor(
        ExpiringMultiPartyCreator derivativeCreator,
        ExpiringMultiPartyCreator.Params memory params,
        address _liquidityProvider,
        Fee memory _fee
    )
        public
        nonReentrant
    {
        liquidityProvider = _liquidityProvider;

        setFee(_fee);

        // Set RToken hat according to the interest fee structure
        rtoken = IRToken(params.collateralAddress);
        hatID = rtoken.createHat(fee.interestFeeRecipients, fee.interestFeeProportions, false);

        // Create the derivative contract
        address derivativeAddress = derivativeCreator.createExpiringMultiParty(params);
        derivative = ExpiringMultiParty(derivativeAddress);
    }

    //----------------------------------------
    // Modifiers
    //----------------------------------------

    modifier onlyLiquidityProvider() {
        require(msg.sender == liquidityProvider, 'Must be liquidity provider');
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
    function mint(
        FixedPoint.Unsigned calldata collateralAmount,
        FixedPoint.Unsigned calldata numTokens
    ) external {
        // Check that LP collateral can support the tokens to be minted
        FixedPoint.Unsigned memory globalCollateralization =
            getGlobalCollateralizationRatioNonReentrant();

        require(
            checkCollateralizationRatioNonReentrant(
                globalCollateralization,
                collateralAmount,
                numTokens
            ),
            "Insufficient collateral available from Liquidity Provider"
        );

        // Calculate fees
        FixedPoint.Unsigned memory feeTotal = collateralAmount.mul(fee.mintFee);

        // Pull user's collateral and mint fee into the TIC
        pullUnderlying(collateralAmount.add(feeTotal));

        // Convert user's collateral to an RToken
        mintRTokens(collateralAmount);

        // Mint synthetic asset with margin from user and provider
        mintSynTokens(numTokens.mul(globalCollateralization), numTokens);

        // Transfer synthetic asset to the user
        transferSynTokens(msg.sender, numTokens);

        // Distribute fees
        // TODO: Consider using the withdrawal pattern for fees
        // TODO: Consider edge cases where math could fail due to truncation
        for (uint256 i = 0; i < fee.mintFeeRecipients.length; i++) {
            require(rtoken.token().transfer(
                fee.mintFeeRecipients[i],
                // This order is important because it mixes FixedPoint with unscaled uint
                feeTotal.mul(fee.mintFeeProportions[i]).div(totalMintFeeProportions).rawValue
            ));
        }
    }

    /**
     * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
     * @param collateralAmount The amount of margin supplied
     */
    function deposit(FixedPoint.Unsigned calldata collateralAmount)
        external
        onlyLiquidityProvider
    {
        // Pull LP's collateral into the TIC
        pullUnderlying(collateralAmount);

        // Convert LP's collateral to an RToken
        mintRTokens(collateralAmount);
    }

    /**
     * @notice Called by a source TIC's `exchange` function to mint destination tokens
     * @dev This function could be called by any account to mint tokens, however they will lose
     *      their excess collateral to the liquidity provider when they redeem the tokens.
     * @param collateralAmount The amount of collateral to use from the source TIC
     * @param numTokens The number of new tokens to mint
     */
    function exchangeMint(
        FixedPoint.Unsigned calldata collateralAmount,
        FixedPoint.Unsigned calldata numTokens
    ) external {
        // Pull RToken collateral from calling TIC contract
        require(pullRTokens(numTokens));

        // Mint new tokens with the collateral
        mintSynTokens(collateralAmount, numTokens);

        // Transfer new tokens back to the calling TIC where they will be sent to the user
        transferSynTokens(msg.sender, numTokens);
    }

    /**
     * @notice Redeem a user's SynFiat tokens for margin currency
     * @notice Requires authorization to transfer the synthetic tokens
     * @dev Because of RToken's Compound allocation strategy, redeeming an
     *      extremely tiny amount of tokens will cause a "redeemTokens zero"
     *      error from the cToken contract.
     * @param numTokens The amount of tokens to redeem
     */
    function redeemTokens(FixedPoint.Unsigned calldata numTokens) external nonReentrant {
        require(numTokens.isGreaterThan(0));

        IERC20 tokenCurrency = derivative.tokenCurrency();
        require(tokenCurrency.balanceOf(msg.sender) >= numTokens.rawValue);

        // Move synthetic tokens from the user to the TIC
        // - This is because derivative expects the tokens to come from the sponsor address
        require(
            tokenCurrency.transferFrom(msg.sender, address(this), numTokens.rawValue),
            'Token transfer failed'
        );

        // Allow the derivative to transfer tokens from the TIC
        require(
            tokenCurrency.approve(address(derivative), numTokens.rawValue),
            'Token approve failed'
        );

        // Redeem the synthetic tokens for RToken collateral
        FixedPoint.Unsigned memory amountWithdrawn = derivative.redeem(numTokens);
        require(amountWithdrawn.isGreaterThan(0), "No tokens were redeemed");

        // Calculate fees
        FixedPoint.Unsigned memory feeTotal = amountWithdrawn.mul(fee.redeemFee);
        FixedPoint.Unsigned memory totalToRedeem = amountWithdrawn.sub(feeTotal);

        // Redeem the RToken collateral for the underlying and transfer to the user
        require(rtoken.redeemAndTransfer(msg.sender, totalToRedeem.rawValue));

        // Distribute fees
        for (uint256 i = 0; i < fee.redeemFeeRecipients.length; i++) {
            require(rtoken.redeemAndTransfer(
                fee.redeemFeeRecipients[i],
                // This order is important because it mixes FixedPoint with unscaled uint
                feeTotal.mul(fee.redeemFeeProportions[i]).div(totalRedeemFeeProportions).rawValue
            ));
        }
    }

    /**
     * @notice Start a withdrawal request
     * @notice Collateral can be withdrawn once the liveness period has elapsed
     * @param collateralAmount The amount of short margin to withdraw
     */
    function withdrawRequest(FixedPoint.Unsigned calldata collateralAmount)
        external
        onlyLiquidityProvider
        nonReentrant
    {
        derivative.requestWithdrawal(collateralAmount);
    }

    /**
     * @notice Withdraw collateral after a withdraw request has passed it's liveness period
     */
    function withdrawPassedRequest() external onlyLiquidityProvider nonReentrant {
        FixedPoint.Unsigned memory amountWithdrawn = derivative.withdrawPassedRequest();
        require(amountWithdrawn.isGreaterThan(0), "No tokens were redeemed");
        require(rtoken.redeemAndTransfer(msg.sender, amountWithdrawn.rawValue));
    }

    /**
     * @notice Redeem tokens after contract expiry
     * @notice After derivative expiry, an LP should use this instead of `withdrawRequest` to
     *         retrieve their collateral.
     */
    function settleExpired() external nonReentrant {
        IERC20 tokenCurrency = derivative.tokenCurrency();

        FixedPoint.Unsigned memory numTokens = FixedPoint.Unsigned(
            tokenCurrency.balanceOf(msg.sender)
        );

        // Make sure there is something for the user to settle
        require(
            numTokens.isGreaterThan(0) || msg.sender == liquidityProvider,
            "Account has nothing to settle"
        );

        if (numTokens.isGreaterThan(0)) {
            // Move synthetic tokens from the user to the TIC
            // - This is because derivative expects the tokens to come from the sponsor address
            require(
                tokenCurrency.transferFrom(msg.sender, address(this), numTokens.rawValue),
                'Token transfer failed'
            );

            // Allow the derivative to transfer tokens from the TIC
            require(
                tokenCurrency.approve(address(derivative), numTokens.rawValue),
                'Token approve failed'
            );
        }

        // Redeem the synthetic tokens for RToken collateral
        FixedPoint.Unsigned memory amountWithdrawn = derivative.settleExpired();
        require(amountWithdrawn.isGreaterThan(0), "No collateral was withdrawn");

        // Amount of RToken collateral that will be redeemed and sent to the user
        FixedPoint.Unsigned memory totalToRedeem;

        // If the user is the LP, send redeemed token collateral plus excess collateral
        if (msg.sender == liquidityProvider) {
            totalToRedeem = amountWithdrawn.add(
                // Redeem LP collateral held in TIC pool
                // Includes excess collateral withdrawn by a user previously calling `settleExpired`
                FixedPoint.Unsigned(rtoken.balanceOf(address(this)))
            );
        } else {
            // Otherwise, separate excess collateral from redeemed token value
            // Must be called after `derivative.settleExpired` to make sure expiryPrice is set
            totalToRedeem = numTokens.mul(FixedPoint.Unsigned(derivative.expiryPrice()));
            require(
                amountWithdrawn.isGreaterThanOrEqual(totalToRedeem),
                "Insufficient collateral withdrawn to redeem tokens"
            );
        }

        // Redeem the RToken collateral for the underlying and transfer to the user
        require(rtoken.redeemAndTransfer(msg.sender, totalToRedeem.rawValue));
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
    function exchange(
        TIC destTIC,
        FixedPoint.Unsigned calldata numTokens,
        FixedPoint.Unsigned calldata destNumTokens
    ) external nonReentrant {
        // Burn the source tokens to get collateral
        FixedPoint.Unsigned memory amountWithdrawn = redeemForCollateral(numTokens);
        require(amountWithdrawn.isGreaterThan(0), "No tokens were redeemed");

        require(rtoken.approve(address(destTIC), amountWithdrawn.rawValue));

        // Mint the destination tokens with the withdrawn collateral
        destTIC.exchangeMint(destNumTokens, amountWithdrawn);

        // Transfer the new tokens to the user
        transferSynTokens(msg.sender, destNumTokens);
    }

    //----------------------------------------
    // External views
    //----------------------------------------

    /**
     * @notice Get the collateral token
     * @return The ERC20 collateral token
     */
    function collateralToken() external view returns (IERC20) {
        return rtoken.token();
    }

    //----------------------------------------
    // Private functions
    //----------------------------------------

    /**
     * @notice Mints an amount of RTokens using the default hat
     * @param numTokens The amount of underlying used to mint RTokens
     */
    function mintRTokens(FixedPoint.Unsigned memory numTokens) private nonReentrant {
        require(
            rtoken.token().approve(address(rtoken), numTokens.rawValue),
            'Token approve failed'
        );
        require(rtoken.mintWithSelectedHat(numTokens.rawValue, hatID));
    }

    /**
     * @notice Pulls RTokens from the sender to store in the TIC
     * @param numTokens The number of tokens to pull
     * @return `true` if the transfer succeeded, otherwise `false`
     */
    function pullRTokens(FixedPoint.Unsigned memory numTokens)
        private
        nonReentrant
        returns (bool)
    {
        return rtoken.transferFrom(msg.sender, address(this), numTokens.rawValue);
    }

    /**
     * @notice Pulls underlying tokens from the sender to store in the TIC
     * @param numTokens The number of tokens to pull
     * @return `true` if the transfer succeeded, otherwise `false`
     */
    function pullUnderlying(FixedPoint.Unsigned memory numTokens)
        private
        nonReentrant
        returns (bool)
    {
        return rtoken.token().transferFrom(msg.sender, address(this), numTokens.rawValue);
    }

    /**
     * @notice Mints synthetic tokens with the available margin
     * @param collateralAmount The amount of collateral to send
     * @param numTokens The number of tokens to mint
     */
    function mintSynTokens(
        FixedPoint.Unsigned memory collateralAmount,
        FixedPoint.Unsigned memory numTokens
    ) private nonReentrant {
        require(rtoken.approve(address(derivative), collateralAmount.rawValue));
        derivative.create(collateralAmount, numTokens);
    }

    /**
     * @notice Transfer synthetic tokens from the derivative to an address
     * @dev Refactored from `mint` to guard against reentrancy
     * @param recipient The address to send the tokens
     * @param amount The number of tokens to send
     */
    function transferSynTokens(address recipient, FixedPoint.Unsigned memory amount)
        private
        nonReentrant
    {
        require(derivative.tokenCurrency().transfer(recipient, amount.rawValue));
    }

    /**
     * @notice Set the TIC fee structure parameters
     * @param _fee The fee structure
     */
    function setFee(Fee memory _fee) private {
        require(
            _fee.mintFeeRecipients.length == _fee.mintFeeProportions.length,
            "Fee recipients and fee proportions do not match"
        );

        fee = _fee;

        // Store the sum of all proportions
        for (uint256 i = 0; i < fee.mintFeeProportions.length; i++) {
            totalMintFeeProportions += fee.mintFeeProportions[i];
        }
    }

    /**
     * @notice Redeem synthetic tokens for collateral from the derivative
     * @param numTokens The number of tokens to redeem
     * @return The amount of collateral withdrawn
     */
    function redeemForCollateral(FixedPoint.Unsigned memory numTokens)
        private
        nonReentrant
        returns (FixedPoint.Unsigned memory)
    {
        require(numTokens.isGreaterThan(0));

        IERC20 tokenCurrency = derivative.tokenCurrency();
        require(tokenCurrency.balanceOf(msg.sender) >= numTokens.rawValue);

        // Move synthetic tokens from the user to the TIC
        // - This is because derivative expects the tokens to come from the sponsor address
        require(
            tokenCurrency.transferFrom(msg.sender, address(this), numTokens.rawValue),
            'Token transfer failed'
        );

        // Allow the derivative to transfer tokens from the TIC
        require(
            tokenCurrency.approve(address(derivative), numTokens.rawValue),
            'Token approve failed'
        );

        // Redeem the synthetic tokens for RToken collateral and return the amount redeemed
        return derivative.redeem(numTokens);
    }

    /**
     * @notice Protects against reentrancy attacks
     * @dev Use in functions where state is modified
     * @dev Use the original function when calling from a view
     * @return The collateralization ratio
     */
    function getGlobalCollateralizationRatioNonReentrant()
        private
        nonReentrant
        returns (FixedPoint.Unsigned memory)
    {
        return getGlobalCollateralizationRatio();
    }

    /**
     * @notice Protects against reentrancy attacks
     * @dev Use in functions where state is modified
     * @dev Use the original function when calling from a view
     * @param globalCollateralization The global collateralization ratio of the derivative
     * @param collateralAmount The amount of additional collateral supplied
     * @param numTokens The number of tokens to mint
     * @return `true` if there is sufficient collateral
     */
    function checkCollateralizationRatioNonReentrant(
        FixedPoint.Unsigned memory globalCollateralization,
        FixedPoint.Unsigned memory collateralAmount,
        FixedPoint.Unsigned memory numTokens
    ) private nonReentrant returns (bool) {
        return checkCollateralizationRatio(globalCollateralization, collateralAmount, numTokens);
    }

    //----------------------------------------
    // Private views
    //----------------------------------------

    /**
     * @notice Get the global collateralization ratio of the derivative
     * @return The collateralization ratio
     */
    function getGlobalCollateralizationRatio()
        private
        view
        returns (FixedPoint.Unsigned memory)
    {
        FixedPoint.Unsigned memory totalTokensOutstanding = FixedPoint.Unsigned(
            derivative.totalTokensOutstanding()
        );

        if (totalTokensOutstanding.isGreaterThan(0)) {
            return derivative.totalPositionCollateral().div(totalTokensOutstanding);
        } else {
            return FixedPoint.fromUnscaledUint(0);
        }
    }

    /**
     * @notice Check if a call to `mint` with the supplied parameters will succeed
     * @dev Compares the new collateral from `collateralAmount` combined with LP collateral
     *      against the collateralization ratio of the derivative.
     * @param globalCollateralization The global collateralization ratio of the derivative
     * @param collateralAmount The amount of additional collateral supplied
     * @param numTokens The number of tokens to mint
     * @return `true` if there is sufficient collateral
     */
    function checkCollateralizationRatio(
        FixedPoint.Unsigned memory globalCollateralization,
        FixedPoint.Unsigned memory collateralAmount,
        FixedPoint.Unsigned memory numTokens
    ) private view returns (bool) {
        // Collateral ratio possible for new tokens accounting for LP collateral
        FixedPoint.Unsigned memory newCollateralization = collateralAmount
            .add(FixedPoint.Unsigned(rtoken.balanceOf(address(this))))
            .div(numTokens);

        // Check that LP collateral can support the tokens to be minted
        return newCollateralization.isGreaterThanOrEqual(globalCollateralization);
    }
}
