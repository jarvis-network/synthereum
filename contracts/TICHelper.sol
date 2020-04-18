pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {TIC} from "./TIC.sol";
import {TICInterface} from "./TICInterface.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {FixedPoint} from "protocol/core/contracts/common/implementation/FixedPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRToken} from "./IRToken.sol";
import {ExpiringMultiParty} from "protocol/core/contracts/financial-templates/implementation/ExpiringMultiParty.sol";

/**
 * @notice TIC implementation is stored here to reduce deployment costs
 * @dev Before refactoring implementation into a library, deploying TICs exceeded gas limits
 */
library TICHelper {
    //----------------------------------------
    // Type definitions
    //----------------------------------------

    using SafeMath for uint256;
    using FixedPoint for FixedPoint.Unsigned;
    using TICHelper for TIC.Storage;

    //----------------------------------------
    // Public functions
    //----------------------------------------

    /**
     * @notice Initializes a fresh TIC
     * @dev Margin currency must be a RToken
     * @dev `_startingCollateralization should be greater than the expected asset price multiplied
     *      by the collateral requirement. The degree to which it is greater should be based on
     *      the expected asset volatility.
     * @param self Data type the library is attached to
     * @param _derivative The `ExpiringMultiParty`
     * @param _liquidityProvider The liquidity provider
     * @param _startingCollateralization Collateralization ratio to use before a global one is set
     * @param _fee The fee structure
     */
    function initialize(
        TIC.Storage storage self,
        ExpiringMultiParty _derivative,
        address _liquidityProvider,
        FixedPoint.Unsigned memory _startingCollateralization,
        TIC.Fee memory _fee
    ) public {
        self.derivative = _derivative;
        self.liquidityProvider = _liquidityProvider;
        self.startingCollateralization = _startingCollateralization;
        self.setFee(_fee);

        // Set RToken hat according to the interest fee structure
        self.rtoken = IRToken(address(self.derivative.collateralCurrency()));
        self.hatID = self.rtoken.createHat(
            self.fee.interestFeeRecipients,
            self.fee.interestFeeProportions,
            false
        );

        // Use hat inheritance to set the derivative's hat
        // - This is necessary to stop an attacker from transfering RToken directly to the
        //   derivative before an LP and redirect all the fees to themselves.
        require(
            self.rtoken.transfer(address(self.derivative), 0),
            "Failed to set the derivative's RToken hat"
        );
    }

    /**
     * @notice User supplies collateral to the TIC and receives synthetic assets
     * @notice Requires authorization to transfer the collateral tokens
     * @param self Data type the library is attached to
     * @param collateralAmount The amount of collateral supplied
     * @param numTokens The number of tokens the user wants to mint
     * TODO: A sponsor could theoretically circumvent the TIC and mint tokens with an extremely
     *       high collateralization ratio at any point in time, preventing users from minting
     *       tokens with the available LP collateral.
     * TODO: A sponsor could theoretically circumvent the TIC and mint tokens with an extremely
     *       low collateralization ratio if they are the derivative's first sponsor, mint tokens
     *       at that ratio through the TIC, forcing the TIC to take on an undercollateralized
     *       position, then liquidate the TIC.
     */
    function mint(
        TIC.Storage storage self,
        FixedPoint.Unsigned memory collateralAmount,
        FixedPoint.Unsigned memory numTokens
    ) public {
        FixedPoint.Unsigned memory globalCollateralization =
            self.getGlobalCollateralizationRatio();

        // Target the starting collateralization ratio if there is no global ratio
        FixedPoint.Unsigned memory targetCollateralization =
            globalCollateralization.isGreaterThan(0)
                ? globalCollateralization
                : self.startingCollateralization;

        // Check that LP collateral can support the tokens to be minted
        require(
            self.checkCollateralizationRatio(targetCollateralization, collateralAmount, numTokens),
            "Insufficient collateral available from Liquidity Provider"
        );

        // Calculate fees
        FixedPoint.Unsigned memory feeTotal = collateralAmount.mul(self.fee.mintFee);

        // Pull user's collateral and mint fee into the TIC
        self.pullUnderlying(collateralAmount.add(feeTotal));

        // Convert user's collateral to an RToken
        self.mintRTokens(collateralAmount);

        // Mint synthetic asset with margin from user and provider
        self.mintSynTokens(numTokens.mul(targetCollateralization), numTokens);

        // Transfer synthetic asset to the user
        self.transferSynTokens(msg.sender, numTokens);

        // Distribute fees
        // TODO: Consider using the withdrawal pattern for fees
        for (uint256 i = 0; i < self.fee.mintFeeRecipients.length; i++) {
            require(self.rtoken.token().transfer(
                self.fee.mintFeeRecipients[i],
                // This order is important because it mixes FixedPoint with unscaled uint
                feeTotal
                    .mul(self.fee.mintFeeProportions[i])
                    .div(self.totalMintFeeProportions)
                    .rawValue
            ));
        }
    }

    /**
     * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
     * @param self Data type the library is attached to
     * @param collateralAmount The amount of margin supplied
     */
    function deposit(
        TIC.Storage storage self,
        FixedPoint.Unsigned memory collateralAmount
    ) public {
        // Pull LP's collateral into the TIC
        self.pullUnderlying(collateralAmount);

        // Convert LP's collateral to an RToken
        self.mintRTokens(collateralAmount);
    }

    /**
     * @notice Called by a source TIC's `exchange` function to mint destination tokens
     * @dev This function could be called by any account to mint tokens, however they will lose
     *      their excess collateral to the liquidity provider when they redeem the tokens.
     * @param self Data type the library is attached to
     * @param collateralAmount The amount of collateral to use from the source TIC
     * @param numTokens The number of new tokens to mint
     */
    function exchangeMint(
        TIC.Storage storage self,
        FixedPoint.Unsigned memory collateralAmount,
        FixedPoint.Unsigned memory numTokens
    ) public {
        // Pull RToken collateral from calling TIC contract
        require(self.pullRTokens(numTokens));

        // Mint new tokens with the collateral
        self.mintSynTokens(collateralAmount, numTokens);

        // Transfer new tokens back to the calling TIC where they will be sent to the user
        self.transferSynTokens(msg.sender, numTokens);
    }

    /**
     * @notice Start a withdrawal request
     * @notice Collateral can be withdrawn once the liveness period has elapsed
     * @param self Data type the library is attached to
     * @param collateralAmount The amount of short margin to withdraw
     */
    function withdrawRequest(
        TIC.Storage storage self,
        FixedPoint.Unsigned memory collateralAmount
    ) public {
        self.derivative.requestWithdrawal(collateralAmount);
    }

    /**
     * @notice Withdraw collateral after a withdraw request has passed it's liveness period
     * TODO: `derivative.withdrawPassedRequest` gets an `amountWithdrawn` return value in commit
     *       86d8ffcd694bbed40140dede179692e7036f2996
     */
    function withdrawPassedRequest(TIC.Storage storage self) public {
        uint256 prevBalance = self.rtoken.balanceOf(address(this));

        // TODO: This will return the amount withdrawn after commit
        //       86d8ffcd694bbed40140dede179692e7036f2996
        self.derivative.withdrawPassedRequest();

        FixedPoint.Unsigned memory amountWithdrawn = FixedPoint.Unsigned(
            self.rtoken.balanceOf(address(this)).sub(prevBalance)
        );
        require(amountWithdrawn.isGreaterThan(0), "No tokens were redeemed");
        require(self.rtoken.redeemAndTransfer(msg.sender, amountWithdrawn.rawValue));
    }

    /**
     * @notice Redeem tokens after contract expiry
     * @notice After derivative expiry, an LP should use this instead of `withdrawRequest` to
     *         retrieve their collateral.
     * TODO: `derivative.settleExpired` gets an `amountWithdrawn` return value in commit
     *       86d8ffcd694bbed40140dede179692e7036f2996
     */
    function settleExpired(TIC.Storage storage self) public {
        IERC20 tokenCurrency = self.derivative.tokenCurrency();

        FixedPoint.Unsigned memory numTokens = FixedPoint.Unsigned(
            tokenCurrency.balanceOf(msg.sender)
        );

        // Make sure there is something for the user to settle
        require(
            numTokens.isGreaterThan(0) || msg.sender == self.liquidityProvider,
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
                tokenCurrency.approve(address(self.derivative), numTokens.rawValue),
                'Token approve failed'
            );
        }

        uint256 prevBalance = self.rtoken.balanceOf(address(this));

        // Redeem the synthetic tokens for RToken collateral
        // TODO: This will return the amount withdrawn after commit
        //       86d8ffcd694bbed40140dede179692e7036f2996
        self.derivative.settleExpired();

        FixedPoint.Unsigned memory amountWithdrawn = FixedPoint.Unsigned(
            self.rtoken.balanceOf(address(this)).sub(prevBalance)
        );
        require(amountWithdrawn.isGreaterThan(0), "No collateral was withdrawn");

        // Amount of RToken collateral that will be redeemed and sent to the user
        FixedPoint.Unsigned memory totalToRedeem;

        // If the user is the LP, send redeemed token collateral plus excess collateral
        if (msg.sender == self.liquidityProvider) {
            // Redeem LP collateral held in TIC pool
            // Includes excess collateral withdrawn by a user previously calling `settleExpired`
            totalToRedeem = FixedPoint.Unsigned(self.rtoken.balanceOf(address(this)));
        } else {
            // Otherwise, separate excess collateral from redeemed token value
            // Must be called after `derivative.settleExpired` to make sure expiryPrice is set
            totalToRedeem = numTokens.mul(FixedPoint.Unsigned(self.derivative.expiryPrice()));
            require(
                amountWithdrawn.isGreaterThanOrEqual(totalToRedeem),
                "Insufficient collateral withdrawn to redeem tokens"
            );
        }

        // Redeem the RToken collateral for the underlying and transfer to the user
        require(self.rtoken.redeemAndTransfer(msg.sender, totalToRedeem.rawValue));
    }

    /**
     * @notice Perform an atomic of tokens between this TIC and the destination TIC
     * @dev The number of destination tokens needs to be calculated relative to the value of the
     *      source tokens and the destination's collateral ratio. If too many destination tokens
     *      are requested the transaction will fail.
     * @param self Data type the library is attached to
     * @param destTIC The destination TIC
     * @param numTokens The number of source tokens to swap
     * @param destNumTokens The number of destination tokens the swap attempts to procure
     */
    function exchange(
        TIC.Storage storage self,
        TICInterface destTIC,
        FixedPoint.Unsigned memory numTokens,
        FixedPoint.Unsigned memory destNumTokens
    ) public {
        uint256 prevBalance = self.rtoken.balanceOf(address(this));

        // Burn the source tokens to get collateral
        // TODO: This will be able to return the amount withdrawn after commit
        //       86d8ffcd694bbed40140dede179692e7036f2996
        self.redeemForCollateral(numTokens);

        FixedPoint.Unsigned memory amountWithdrawn = FixedPoint.Unsigned(
            self.rtoken.balanceOf(address(this)).sub(prevBalance)
        );
        require(amountWithdrawn.isGreaterThan(0), "No tokens were redeemed");

        require(self.rtoken.approve(address(destTIC), amountWithdrawn.rawValue));

        // Mint the destination tokens with the withdrawn collateral
        destTIC.exchangeMint(destNumTokens, amountWithdrawn);

        // Transfer the new tokens to the user
        self.transferSynTokens(msg.sender, destNumTokens);
    }

    //----------------------------------------
    // Internal functions
    //----------------------------------------

    /**
     * @notice Mints an amount of RTokens using the default hat
     * @param self Data type the library is attached to
     * @param numTokens The amount of underlying used to mint RTokens
     */
    function mintRTokens(TIC.Storage storage self, FixedPoint.Unsigned memory numTokens) internal {
        require(
            self.rtoken.token().approve(address(self.rtoken), numTokens.rawValue),
            'Token approve failed'
        );
        require(self.rtoken.mintWithSelectedHat(numTokens.rawValue, self.hatID));
    }

    /**
     * @notice Pulls RTokens from the sender to store in the TIC
     * @param self Data type the library is attached to
     * @param numTokens The number of tokens to pull
     * @return `true` if the transfer succeeded, otherwise `false`
     */
    function pullRTokens(
        TIC.Storage storage self,
        FixedPoint.Unsigned memory numTokens
    ) internal returns (bool) {
        return self.rtoken.transferFrom(msg.sender, address(this), numTokens.rawValue);
    }

    /**
     * @notice Pulls underlying tokens from the sender to store in the TIC
     * @param self Data type the library is attached to
     * @param numTokens The number of tokens to pull
     * @return `true` if the transfer succeeded, otherwise `false`
     */
    function pullUnderlying(
        TIC.Storage storage self,
        FixedPoint.Unsigned memory numTokens
    ) internal returns (bool) {
        return self.rtoken.token().transferFrom(msg.sender, address(this), numTokens.rawValue);
    }

    /**
     * @notice Mints synthetic tokens with the available margin
     * @param self Data type the library is attached to
     * @param collateralAmount The amount of collateral to send
     * @param numTokens The number of tokens to mint
     */
    function mintSynTokens(
        TIC.Storage storage self, 
        FixedPoint.Unsigned memory collateralAmount,
        FixedPoint.Unsigned memory numTokens
    ) internal {
        require(self.rtoken.approve(address(self.derivative), collateralAmount.rawValue));
        self.derivative.create(collateralAmount, numTokens);
    }

    /**
     * @notice Transfer synthetic tokens from the derivative to an address
     * @dev Refactored from `mint` to guard against reentrancy
     * @param self Data type the library is attached to
     * @param recipient The address to send the tokens
     * @param numTokens The number of tokens to send
     */
    function transferSynTokens(
        TIC.Storage storage self,
        address recipient,
        FixedPoint.Unsigned memory numTokens
    ) internal {
        require(self.derivative.tokenCurrency().transfer(recipient, numTokens.rawValue));
    }

    /**
     * @notice Set the TIC fee structure parameters
     * @param self Data type the library is attached to
     * @param _fee The fee structure
     */
    function setFee(TIC.Storage storage self, TIC.Fee memory _fee) internal {
        require(
            _fee.mintFeeRecipients.length == _fee.mintFeeProportions.length,
            "Fee recipients and fee proportions do not match"
        );

        self.fee = _fee;

        // Store the sum of all proportions
        for (uint256 i = 0; i < self.fee.mintFeeProportions.length; i++) {
            self.totalMintFeeProportions += self.fee.mintFeeProportions[i];
        }
    }

    /**
     * @notice Redeem synthetic tokens for collateral from the derivative
     * @param self Data type the library is attached to
     * @param numTokens The number of tokens to redeem
     * TODO: `derivative.redeem` gets an `amountWithdrawn` return value in commit
     *       86d8ffcd694bbed40140dede179692e7036f2996
     */
    function redeemForCollateral(TIC.Storage storage self, FixedPoint.Unsigned memory numTokens) internal {
        require(numTokens.isGreaterThan(0));

        IERC20 tokenCurrency = self.derivative.tokenCurrency();
        require(tokenCurrency.balanceOf(msg.sender) >= numTokens.rawValue);

        // Move synthetic tokens from the user to the TIC
        // - This is because derivative expects the tokens to come from the sponsor address
        require(
            tokenCurrency.transferFrom(msg.sender, address(this), numTokens.rawValue),
            'Token transfer failed'
        );

        // Allow the derivative to transfer tokens from the TIC
        require(
            tokenCurrency.approve(address(self.derivative), numTokens.rawValue),
            'Token approve failed'
        );

        // Redeem the synthetic tokens for RToken collateral
        self.derivative.redeem(numTokens);
    }

    //----------------------------------------
    //  Internal views
    //----------------------------------------

    /**
     * @notice Get the global collateralization ratio of the derivative
     * @param self Data type the library is attached to
     * @return The collateralization ratio
     */
    function getGlobalCollateralizationRatio(TIC.Storage storage self)
        internal
        view
        returns (FixedPoint.Unsigned memory)
    {
        FixedPoint.Unsigned memory totalTokensOutstanding = FixedPoint.Unsigned(
            self.derivative.totalTokensOutstanding()
        );

        if (totalTokensOutstanding.isGreaterThan(0)) {
            return self.derivative.totalPositionCollateral().div(totalTokensOutstanding);
        } else {
            return FixedPoint.fromUnscaledUint(0);
        }
    }

    /**
     * @notice Check if a call to `mint` with the supplied parameters will succeed
     * @dev Compares the new collateral from `collateralAmount` combined with LP collateral
     *      against the collateralization ratio of the derivative.
     * @param self Data type the library is attached to
     * @param globalCollateralization The global collateralization ratio of the derivative
     * @param collateralAmount The amount of additional collateral supplied
     * @param numTokens The number of tokens to mint
     * @return `true` if there is sufficient collateral
     */
    function checkCollateralizationRatio(
        TIC.Storage storage self, 
        FixedPoint.Unsigned memory globalCollateralization,
        FixedPoint.Unsigned memory collateralAmount,
        FixedPoint.Unsigned memory numTokens
    ) internal view returns (bool) {
        // Collateral ratio possible for new tokens accounting for LP collateral
        FixedPoint.Unsigned memory newCollateralization = collateralAmount
            .add(FixedPoint.Unsigned(self.rtoken.balanceOf(address(this))))
            .div(numTokens);

        // Check that LP collateral can support the tokens to be minted
        return newCollateralization.isGreaterThanOrEqual(globalCollateralization);
    }
}
