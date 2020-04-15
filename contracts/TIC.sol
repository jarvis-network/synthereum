pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {TICInterface} from "./TICInterface.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {FixedPoint} from "protocol/core/contracts/common/implementation/FixedPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRToken} from "./IRToken.sol";
import {ExpiringMultiParty} from "protocol/core/contracts/financial-templates/implementation/ExpiringMultiParty.sol";

/**
 * @title Token Issuer Contract
 * @notice Collects margin, issues synthetic assets, and distributes accrued interest
 * @dev Collateral is wrapped by an `RToken` to accrue and distribute interest before being sent
 *      to the `ExpiringMultiParty` contract
 */
contract TIC is TICInterface, ReentrancyGuard {
    //----------------------------------------
    // Type definitions
    //----------------------------------------

    using SafeMath for uint256;
    using FixedPoint for FixedPoint.Unsigned;

    //----------------------------------------
    // State variables
    //----------------------------------------

    ExpiringMultiParty public derivative;
    FixedPoint.Unsigned private startingCollateralization;
    address private liquidityProvider;
    IRToken public rtoken;
    uint256 private hatID;
    Fee public fee;

    // Used with individual proportions to scale values
    uint256 private totalMintFeeProportions;

    // Used to prevent the contract from being re-initialized
    bool private initialized = false;

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
    ) external override {
        FixedPoint.Unsigned memory globalCollateralization =
            getGlobalCollateralizationRatioNonReentrant();

        // Target the starting collateralization ratio if there is no global ratio
        FixedPoint.Unsigned memory targetCollateralization =
            globalCollateralization.isGreaterThan(0)
                ? globalCollateralization
                : startingCollateralization;

        // Check that LP collateral can support the tokens to be minted
        require(
            checkCollateralizationRatioNonReentrant(
                targetCollateralization,
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
        mintSynTokens(numTokens.mul(targetCollateralization), numTokens);

        // Transfer synthetic asset to the user
        transferSynTokens(msg.sender, numTokens);

        // Distribute fees
        // TODO: Consider using the withdrawal pattern for fees
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
        override
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
    ) external override {
        // Pull RToken collateral from calling TIC contract
        require(pullRTokens(numTokens));

        // Mint new tokens with the collateral
        mintSynTokens(collateralAmount, numTokens);

        // Transfer new tokens back to the calling TIC where they will be sent to the user
        transferSynTokens(msg.sender, numTokens);
    }

    /**
     * @notice Start a withdrawal request
     * @notice Collateral can be withdrawn once the liveness period has elapsed
     * @param collateralAmount The amount of short margin to withdraw
     */
    function withdrawRequest(FixedPoint.Unsigned calldata collateralAmount)
        external
        override
        onlyLiquidityProvider
        nonReentrant
    {
        derivative.requestWithdrawal(collateralAmount);
    }

    /**
     * @notice Withdraw collateral after a withdraw request has passed it's liveness period
     * TODO: `derivative.withdrawPassedRequest` gets an `amountWithdrawn` return value in commit
     *       86d8ffcd694bbed40140dede179692e7036f2996
     */
    function withdrawPassedRequest() external override onlyLiquidityProvider nonReentrant {
        uint256 prevBalance = rtoken.balanceOf(address(this));

        // TODO: This will return the amount withdrawn after commit
        //       86d8ffcd694bbed40140dede179692e7036f2996
        derivative.withdrawPassedRequest();

        FixedPoint.Unsigned memory amountWithdrawn = FixedPoint.Unsigned(
            rtoken.balanceOf(address(this)).sub(prevBalance)
        );
        require(amountWithdrawn.isGreaterThan(0), "No tokens were redeemed");
        require(rtoken.redeemAndTransfer(msg.sender, amountWithdrawn.rawValue));
    }

    /**
     * @notice Redeem tokens after contract expiry
     * @notice After derivative expiry, an LP should use this instead of `withdrawRequest` to
     *         retrieve their collateral.
     * TODO: `derivative.settleExpired` gets an `amountWithdrawn` return value in commit
     *       86d8ffcd694bbed40140dede179692e7036f2996
     */
    function settleExpired() external override nonReentrant {
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

        uint256 prevBalance = rtoken.balanceOf(address(this));

        // Redeem the synthetic tokens for RToken collateral
        // TODO: This will return the amount withdrawn after commit
        //       86d8ffcd694bbed40140dede179692e7036f2996
        derivative.settleExpired();

        FixedPoint.Unsigned memory amountWithdrawn = FixedPoint.Unsigned(
            rtoken.balanceOf(address(this)).sub(prevBalance)
        );
        require(amountWithdrawn.isGreaterThan(0), "No collateral was withdrawn");

        // Amount of RToken collateral that will be redeemed and sent to the user
        FixedPoint.Unsigned memory totalToRedeem;

        // If the user is the LP, send redeemed token collateral plus excess collateral
        if (msg.sender == liquidityProvider) {
            // Redeem LP collateral held in TIC pool
            // Includes excess collateral withdrawn by a user previously calling `settleExpired`
            totalToRedeem = FixedPoint.Unsigned(rtoken.balanceOf(address(this)));
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
        TICInterface destTIC,
        FixedPoint.Unsigned calldata numTokens,
        FixedPoint.Unsigned calldata destNumTokens
    ) external override nonReentrant {
        uint256 prevBalance = rtoken.balanceOf(address(this));

        // Burn the source tokens to get collateral
        // TODO: This will be able to return the amount withdrawn after commit
        //       86d8ffcd694bbed40140dede179692e7036f2996
        redeemForCollateral(numTokens);

        FixedPoint.Unsigned memory amountWithdrawn = FixedPoint.Unsigned(
            rtoken.balanceOf(address(this)).sub(prevBalance)
        );
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
    function collateralToken() external view override returns (IERC20) {
        return rtoken.token();
    }

    //----------------------------------------
    // Public functions
    //----------------------------------------

    /**
     * @notice Set initial TIC parameters
     * @dev Has to be marked `public` instead of `external` so the fee struct can be `memory`.
     *      Compilation will fail attempting to use `setFee` if the struct is in `calldata`.
     * @dev Should be called in the same transaction that creates the contract to prevent a third
     *      party from front-running initialization.
     * @dev `initialize` is separate from the constructor so it could be specified in an interface
     * @dev Margin currency must be a RToken
     * @param _derivative The `ExpiringMultiParty`
     * @param _liquidityProvider The liquidity provider
     * @param _startingCollateralization Collateralization ratio to use before a global one is set
     * @param _fee The fee structure
     */
    function initialize (
        ExpiringMultiParty _derivative,
        address _liquidityProvider,
        FixedPoint.Unsigned memory _startingCollateralization,
        Fee memory _fee
    ) public override nonReentrant {
        require(!initialized, "The TIC has already been initialized");
        initialized = true;

        derivative = _derivative;
        liquidityProvider = _liquidityProvider;
        startingCollateralization = _startingCollateralization;
        setFee(_fee);

        // Set RToken hat according to the interest fee structure
        rtoken = IRToken(address(derivative.collateralCurrency()));
        hatID = rtoken.createHat(fee.interestFeeRecipients, fee.interestFeeProportions, false);

        // Use hat inheritance to set the derivative's hat
        // - This is necessary to stop an attacker from transfering RToken directly to the
        //   derivative before an LP and redirect all the fees to themselves.
        require(
            rtoken.transfer(address(derivative), 1),
            "Failed to set the derivative's RToken hat"
        );
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
     * TODO: `derivative.redeem` gets an `amountWithdrawn` return value in commit
     *       86d8ffcd694bbed40140dede179692e7036f2996
     */
    function redeemForCollateral(FixedPoint.Unsigned memory numTokens) private nonReentrant {
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
        derivative.redeem(numTokens);
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
