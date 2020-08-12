pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import {TICInterface} from "./TICInterface.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {FixedPoint} from "./uma-contracts/common/implementation/FixedPoint.sol";
import {HitchensUnorderedKeySetLib} from "./HitchensUnorderedKeySet.sol";
import {TICHelper} from "./TICHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRToken} from "./IRToken.sol";
import {IExpiringMultiParty} from "./IExpiringMultiParty.sol";

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
    using HitchensUnorderedKeySetLib for HitchensUnorderedKeySetLib.Set;
    using TICHelper for Storage;

    struct Storage {
        IExpiringMultiParty derivative;
        FixedPoint.Unsigned startingCollateralization;
        address liquidityProvider;
        address validator;
        IRToken rtoken;
        uint256 hatID;
        Fee fee;

        // Used with individual proportions to scale values
        uint256 totalMintFeeProportions;

        mapping(bytes32 => MintRequest) mintRequests;
        HitchensUnorderedKeySetLib.Set mintRequestSet;

        mapping(bytes32 => ExchangeRequest) exchangeRequests;
        HitchensUnorderedKeySetLib.Set exchangeRequestSet;

        mapping(bytes32 => RedeemRequest) redeemRequests;
        HitchensUnorderedKeySetLib.Set redeemRequestSet;
    }

    event MintRequested(
        bytes32 mintID,
        uint256 timestamp,
        address indexed sender,
        uint256 collateralAmount,
        uint256 numTokens
    );
    event MintApproved(bytes32 mintID, address indexed sender);
    event MintRejected(bytes32 mintID, address indexed sender);

    event ExchangeRequested(
        bytes32 exchangeID,
        uint256 timestamp,
        address indexed sender,
        address destTIC,
        uint256 numTokens,
        uint256 destNumTokens
    );
    event ExchangeApproved(bytes32 exchangeID, address indexed sender);
    event ExchangeRejected(bytes32 exchangeID, address indexed sender);

    event RedeemRequested(
        bytes32 redeemID,
        uint256 timestamp,
        address indexed sender,
        uint256 collateralAmount,
        uint256 numTokens
    );
    event RedeemApproved(bytes32 redeemID, address indexed sender);
    event RedeemRejected(bytes32 redeemID, address indexed sender);

    //----------------------------------------
    // State variables
    //----------------------------------------

    Storage private ticStorage;

    //----------------------------------------
    // Constructor
    //----------------------------------------

    /**
     * @notice The derivative's margin currency must be a RToken
     * @notice The validator will generally be an address owned by the LP
     * @notice `_startingCollateralization should be greater than the expected asset price multiplied
     *      by the collateral requirement. The degree to which it is greater should be based on
     *      the expected asset volatility.
     * @param _derivative The `ExpiringMultiParty`
     * @param _liquidityProvider The liquidity provider
     * @param _validator The address that validates mint and exchange requests
     * @param _startingCollateralization Collateralization ratio to use before a global one is set
     * @param _fee The fee structure
     */
    constructor (
        IExpiringMultiParty _derivative,
        address _liquidityProvider,
        address _validator,
        uint256 _startingCollateralization,
        Fee memory _fee
    ) public nonReentrant {
        ticStorage.initialize(
            _derivative,
            _liquidityProvider,
            _validator,
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

    modifier onlyValidator() {
        require(msg.sender == ticStorage.validator, 'Must be validator');
        _;
    }

    //----------------------------------------
    // External functions
    //----------------------------------------

    /**
     * @notice Submit a request to mint tokens
     * @notice The request needs to approved by the LP before tokens are created. This is
     *         necessary to prevent users from abusing LPs by minting large amounts of tokens
     *         with little collateral.
     * @notice User must approve collateral transfer for the mint request to succeed
     * @param collateralAmount The amount of collateral supplied
     * @param numTokens The number of tokens the user wants to mint
     */
    function mintRequest(uint256 collateralAmount, uint256 numTokens)
        external
        override
        nonReentrant
    {
        bytes32 mintID = ticStorage.mintRequest(
            FixedPoint.Unsigned(collateralAmount),
            FixedPoint.Unsigned(numTokens)
        );

        emit MintRequested(mintID, now, msg.sender, collateralAmount, numTokens);
    }

    /**
     * @notice Approve a mint request as an LP
     * @notice This will typically be done with a keeper bot
     * @notice User needs to have approved the transfer of collateral tokens
     * @param mintID The ID of the mint request
     */
    function approveMint(bytes32 mintID) external override nonReentrant onlyValidator {
        address sender = ticStorage.mintRequests[mintID].sender;

        ticStorage.approveMint(mintID);

        emit MintApproved(mintID, sender);
    }


    /**
     * @notice Reject a mint request as an LP
     * @notice This will typically be done with a keeper bot
     * @param mintID The ID of the mint request
     */
    function rejectMint(bytes32 mintID) external override nonReentrant onlyValidator {
        address sender = ticStorage.mintRequests[mintID].sender;

        ticStorage.rejectMint(mintID);

        emit MintRejected(mintID, sender);
    }

    /**
     * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
     * @param collateralAmount The amount of margin supplied
     */
    function deposit(uint256 collateralAmount)
        external
        override
        nonReentrant
        onlyLiquidityProvider
    {
        ticStorage.deposit(FixedPoint.Unsigned(collateralAmount));
    }

    /**
     * @notice Liquidity provider withdraw margin from the TIC
     * @param collateralAmount The amount of margin to withdraw
     */
    function withdraw(uint256 collateralAmount)
        external
        override
        nonReentrant
        onlyLiquidityProvider
    {
        ticStorage.withdraw(FixedPoint.Unsigned(collateralAmount));
    }

    /**
     * TODO: Potentially restrict this function to only TICs registered on a whitelist
     * @notice Called by a source TIC's `exchange` function to mint destination tokens
     * @dev This function could be called by any account to mint tokens, however they will lose
     *      their excess collateral to the liquidity provider when they redeem the tokens.
     * @param collateralAmount The amount of collateral to use from the source TIC
     * @param numTokens The number of new tokens to mint
     */
    function exchangeMint(uint256 collateralAmount, uint256 numTokens)
        external
        override
        nonReentrant
    {
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
     * @notice Submit a request to redeem tokens
     * @notice The request needs to approved by the LP before tokens are created. This is
     *         necessary to prevent users from abusing LPs by redeeming large amounts of collateral
     *         from a small number of tokens.
     * @notice User must approve synthetic token transfer for the redeem request to succeed
     * @param collateralAmount The amount of collateral to redeem tokens for
     * @param numTokens The number of tokens to redeem
     */
    function redeemRequest(uint256 collateralAmount, uint256 numTokens)
        external
        override
        nonReentrant
    {
        bytes32 redeemID = ticStorage.redeemRequest(
            FixedPoint.Unsigned(collateralAmount),
            FixedPoint.Unsigned(numTokens)
        );

        emit RedeemRequested(redeemID, now, msg.sender, collateralAmount, numTokens);
    }

    /**
     * @notice Approve a redeem request as an LP
     * @notice This will typically be done with a keeper bot
     * @notice User needs to have approved the transfer of synthetic tokens
     * @param redeemID The ID of the redeem request
     */
    function approveRedeem(bytes32 redeemID) external override nonReentrant onlyValidator {
        address sender = ticStorage.redeemRequests[redeemID].sender;

        ticStorage.approveRedeem(redeemID);

        emit RedeemApproved(redeemID, sender);
    }

    /**
     * @notice Reject a redeem request as an LP
     * @notice This will typically be done with a keeper bot
     * @param redeemID The ID of the redeem request
     */
    function rejectRedeem(bytes32 redeemID) external override nonReentrant onlyValidator {
        address sender = ticStorage.redeemRequests[redeemID].sender;

        ticStorage.rejectRedeem(redeemID);

        emit RedeemRejected(redeemID, sender);
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
     * @notice Submit a request to perform an atomic of tokens between TICs
     * @dev The number of destination tokens needs to be calculated relative to the value of the
     *      source tokens and the destination's collateral ratio. If too many destination tokens
     *      are requested the transaction will fail.
     * @param destTIC The destination TIC
     * @param numTokens The number of source tokens to swap
     * @param destNumTokens The number of destination tokens the swap attempts to procure
     */
    function exchangeRequest(TICInterface destTIC, uint256 numTokens, uint256 destNumTokens)
        external
        override
        nonReentrant
    {
        bytes32 exchangeID = ticStorage.exchangeRequest(
            destTIC,
            FixedPoint.Unsigned(numTokens),
            FixedPoint.Unsigned(destNumTokens)
        );

        emit ExchangeRequested(
            exchangeID,
            now,
            msg.sender,
            address(destTIC),
            numTokens,
            destNumTokens
        );
    }

    /**
     * @notice Approve an exchange request
     * @notice This will typically be done with a keeper bot
     * @notice User needs to have approved the transfer of synthetic tokens
     * @param exchangeID The ID of the exchange request
     */
    function approveExchange(bytes32 exchangeID) external override onlyValidator nonReentrant {
        address sender = ticStorage.exchangeRequests[exchangeID].sender;

        ticStorage.approveExchange(exchangeID);

        emit ExchangeApproved(exchangeID, sender);
    }


    /**
     * @notice Reject an exchange request
     * @notice This will typically be done with a keeper bot
     * @param exchangeID The ID of the exchange request
     */
    function rejectExchange(bytes32 exchangeID) external override onlyValidator nonReentrant {
        address sender = ticStorage.exchangeRequests[exchangeID].sender;

        ticStorage.rejectExchange(exchangeID);

        emit ExchangeRejected(exchangeID, sender);
    }

    //----------------------------------------
    // External views
    //----------------------------------------

    /**
     * @notice Get the derivative contract
     * @return The `ExpiringMultiParty` derivative contract
     */
    function derivative() external view override returns (IExpiringMultiParty) {
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

    /**
     * @notice Calculate the fees a user will have to pay to mint tokens with their collateral
     * @return The fee structure
     */
    function calculateMintFee(uint256 collateralAmount) external view override returns (uint256) {
        return FixedPoint.Unsigned(collateralAmount).mul(ticStorage.fee.mintFee).rawValue;
    }

    /**
     * @notice Get all open mint requests
     * @return An array of mint requests
     */
    function getMintRequests() external view override returns (MintRequest[] memory) {
        return ticStorage.getMintRequests();
    }

    /**
     * @notice Get all open redeem requests
     * @return An array of redeem requests
     */
    function getRedeemRequests() external view override returns (RedeemRequest[] memory) {
        return ticStorage.getRedeemRequests();
    }

    /**
     * @notice Get all open exchange requests
     * @return An array of exchange requests
     */
    function getExchangeRequests() external view override returns (ExchangeRequest[] memory) {
        return ticStorage.getExchangeRequests();
    }
}
