pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
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
contract TIC is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using FixedPoint for FixedPoint.Unsigned;

    ExpiringMultiParty public derivative;
    IRToken public rtoken;
    address private liquidityProvider;
    uint256 private hatID;

    /**
     * @notice Margin currency must be a rtoken
     * @dev TIC creates a new derivative so it is set as the sponsor
     * @param derivativeCreator The `ExpiringMultiPartyCreator`
     * @param params The `ExpiringMultiParty` parameters
     * @param _liquidityProvider The liquidity provider
     * @param _owner The account that receives interest from the collateral
     */
    constructor(
        ExpiringMultiPartyCreator derivativeCreator,
        ExpiringMultiPartyCreator.Params memory params,
        address _liquidityProvider,
        address _owner
    )
        public
        nonReentrant
    {
        rtoken = IRToken(params.collateralAddress);
        liquidityProvider = _liquidityProvider;

        address derivativeAddress = derivativeCreator.createExpiringMultiParty(params);
        derivative = ExpiringMultiParty(derivativeAddress);

        transferOwnership(_owner);

        // Interest is distributed 90/10 to the protocol and liquidity provider
        address[] memory recipients = new address[](2);
        recipients[0] = owner();
        recipients[1] = liquidityProvider;
        uint32[] memory proportions = new uint32[](1);
        proportions[0] = 10;
        proportions[1] = 90;

        hatID = rtoken.createHat(recipients, proportions, false);
    }

    modifier onlyLiquidityProvider() {
        require(msg.sender == liquidityProvider, 'Must be liquidity provider');
        _;
    }

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
        FixedPoint.Unsigned memory globalCollateralization = getGlobalCollateralizationRatio();

        require(
            checkCollateralizationRatio(globalCollateralization, collateralAmount, numTokens),
            "Insufficient collateral available from Liquidity Provider"
        );

        // Convert user's collateral to an RToken
        mintRTokens(collateralAmount);

        // Mint synthetic asset with margin from user and provider
        mintSynTokens(numTokens.mul(globalCollateralization), numTokens);

        // Transfer synthetic asset to the user
        transferSynTokens(msg.sender, numTokens);
    }

    /**
     * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
     * @param collateralAmount The amount of margin supplied
     */
    function deposit(FixedPoint.Unsigned calldata collateralAmount)
        external
        onlyLiquidityProvider
    {
        // Convert LP's collateral to an RToken and hold it in the TIC
        mintRTokens(collateralAmount);
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
        require(numTokens > 0);
        require(derivative.balanceOf(msg.sender) >= numTokens);

        // Move synthetic tokens from the user to the TIC
        // - This is because derivative expects the tokens to come from the sponsor address
        require(
            derivative.transferFrom(msg.sender, address(this), numTokens),
            'Token transfer failed'
        );

        // Allow the derivative to transfer tokens from the TIC
        require(
            derivative.approve(address(derivative), numTokens),
            'Token approve failed'
        );

        // Redeem the synthetic tokens for RToken collateral
        FixedPoint.Unsigned memory amountWithdrawn = derivative.redeem(numTokens);
        require(amountWithdrawn > 0, "No tokens were redeemed");

        // Redeem the RToken collateral for the underlying and transfer to the user
        require(rtoken.redeemAndTransfer(msg.sender, amountWithdrawn));
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
        require(amountWithdrawn > 0, "No tokens were redeemed");
        require(rtoken.redeemAndTransfer(msg.sender, amountWithdrawn));
    }

    /**
     * @notice Get the collateral token
     * @return The ERC20 collateral token
     */
    function token() external view nonReentrant returns (IERC20) {
        return rtoken.token();
    }

    /**
     * @notice Mints an amount of RTokens using the default hat
     * @param amount The amount of underlying used to mint RTokens
     */
    function mintRTokens(FixedPoint.Unsigned memory amount) private nonReentrant {
        IERC20 _token = rtoken.token();
        require(
            _token.transferFrom(msg.sender, address(this), amount),
            'Token transfer failed'
        );
        require(_token.approve(address(rtoken), amount), 'Token approve failed');
        require(rtoken.mintWithSelectedHat(amount, hatID));
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
        require(rtoken.approve(address(derivative), collateralAmount));
        derivative.create(collateralAmount, tokensToMint);
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
        require(derivative.transfer(recipient, amount));
    }

    /**
     * @notice Get the global collateralization ratio of the derivative
     * @return The collateralization ratio
     */
    function getGlobalCollateralizationRatio()
        private
        view
        nonReentrant
        returns (FixedPoint.Unsigned memory)
    {
        FixedPoint.Unsigned memory totalTokensOutstanding = derivative.totalTokensOutstanding();

        if (totalTokensOutstanding.isGreaterThan(0)) {
            return derivative.totalPositionCollateral().div(totalTokensOutstanding);
        } else {
            return FixedPoint.fromUnscaledUint(0);
        }
    }

    /**
     * @notice Check if a call to `mint` with the supplied parameters will succeed
     * @dev Compares the new collateral from `collateralAmount` combined with LP collateral
     *      against the collateral requirements of the derivative.
     * @param globalCollateralization The global collateralization ratio of the derivative
     * @param collateralAmount The amount of additional collateral supplied
     * @param numTokens The number of tokens to mint
     * @return `true` if there is sufficient collateral
     */
    function checkCollateralizationRatio(
        FixedPoint.Unsigned memory globalCollateralization,
        FixedPoint.Unsigned memory collateralAmount,
        FixedPoint.Unsigned memory numTokens
    ) private view nonReentrant returns (bool) {
        // Collateral ratio possible for new tokens accounting for LP collateral
        FixedPoint.Unsigned memory newCollateralization = collateralAmount
            .add(rtoken.balanceOf(address(this)))
            .div(numTokens);

        // Check that LP collateral can support the tokens to be minted
        return newCollateralization.isGreaterThanOrEqual(
            derivative.collateralRequirement().max(globalCollateralization)
        );
    }
}
