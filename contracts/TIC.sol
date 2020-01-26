pragma solidity >=0.5.14 <0.7.0;
pragma experimental ABIEncoderV2;

// prevent conflict with RToken declarations
import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20, RToken} from "@rtoken/contracts/contracts/RToken.sol";
import {TokenizedDerivative} from "protocol/core/contracts/TokenizedDerivative.sol";
import {TokenizedDerivativeCreator} from "protocol/core/contracts/TokenizedDerivativeCreator.sol";
import {ForexTime} from "./ForexTime.sol";

/**
 * @title Token Issuer Contract
 * @notice Collects margin, issues synthetic assets, and distributes accrued interest
 * @dev Margin currency is sent to an `RToken` and used as collateral for a
 *      `TokenizedDerivative` synthetic asset
 */
contract TIC is Ownable, ReentrancyGuard, ForexTime {
    using SafeMath for uint256;

    uint256 private constant INT_MAX = 2**255 - 1;
    uint256 private constant UINT_FP_SCALING_FACTOR = 1e18;

    uint256 private supportedMove;
    TokenizedDerivative private derivative;
    RToken private rtoken;
    address private provider;
    uint256 private hatID;
    uint256 private userDepositsTotal;
    uint256 private providerDeposit;

    mapping(address => uint256) private userDeposits;

    /**
     * @notice _supportedMove must match the derivative supportedMove
     * @notice _rtoken must match the derivative marginCurrency
     */
    constructor(
        TokenizedDerivative _derivative,
        uint256 _supportedMove,
        RToken _rtoken,
        address _provider
    )
        public
    {
        // stack error occurs when trying to get params from an existing
        // derivative so instead we manually pass the supported move and
        // rtoken.
        derivative = _derivative;
        supportedMove = _supportedMove;
        rtoken = _rtoken;
        provider = _provider;

        // all interest accrued is distributed to the owner
        address[] memory recipients = new address[](1);
        recipients[0] = owner();
        uint32[] memory proportions = new uint32[](1);
        proportions[0] = 100;

        hatID = rtoken.createHat(recipients, proportions, false);
    }

    modifier onlyProvider() {
        require(msg.sender == provider, 'Must be liquidity provider');
        _;
    }

    /**
     * @notice Sender supplies margin to the TIC and receives synthetic assets
     * @notice Requires authorization to transfer the margin currency
     * @param amount The amount of margin supplied
     */
    function mint(uint256 amount) external nonReentrant forexOpen {
        // get margin required for user's deposit
        uint256 newMargin = takePercentage(amount, supportedMove);

        require(newMargin <= INT_MAX);

        // get outstanding short margin requirement
        int256 excessMargin = derivative.calcExcessMargin();
        int256 requiredMargin = int256(newMargin) - excessMargin;

        require(providerDeposit <= INT_MAX);
        require(
            int256(providerDeposit) >= requiredMargin,
            'Insufficient margin'
        );

        // update underlying asset deposit balances
        userDeposits[msg.sender] = userDeposits[msg.sender].add(amount);
        userDepositsTotal = userDepositsTotal.add(amount);

        // mint r tokens for derivative margin
        mintRTokens(amount);

        // mint synthetic asset with margin from user and provider
        mintSynTokens(amount);
    }

    /**
     * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
     * @notice Requires authorization to transfer the margin currency
     * @param amountToDeposit The amount of margin supplied
     */
    function deposit(uint256 amountToDeposit) external payable onlyProvider {
        // update underlying asset deposit balance
        providerDeposit = providerDeposit.add(amountToDeposit);

        // mint r tokens for derivative margin
        mintRTokens(amountToDeposit);

        // deposit margin so users can mint synthetic assets
        rtoken.approve(address(derivative), amountToDeposit);
        derivative.deposit(amountToDeposit);
    }

    /**
     * @notice Redeem a user's SynFiat tokens for margin currency
     * @param tokensToRedeem The amount of tokens to redeem
     */
    function redeemTokens(uint256 tokensToRedeem) external forexOpen {
        require(tokensToRedeem > 0);
        require(derivative.balanceOf(msg.sender) >= tokensToRedeem);

        derivative.redeemTokens(tokensToRedeem);

        require(rtoken.redeemAndTransfer(msg.sender, tokensToRedeem));
    }

    /**
     * @notice Withdraw the excess short margin supplied by the provider
     * @param amount The amount of short margin to withdraw
     */
    function withdraw(uint256 amount) external onlyProvider {
        derivative.withdraw(amount);
    }

    /**
     * @notice Returns the required margin a liquidity provider must supply
     */
    function getProviderRequiredMargin() external view returns (int256) {
        return derivative.getCurrentRequiredMargin();
    }
 
    /**
     * @notice Returns the margin in excess of the liquidity providers margin requirement
     * @dev Value will be negative if the margin is below the margin requirement
     */
    function getProviderExcessMargin() external view returns (int256) {
        return derivative.calcExcessMargin();
    }

    /**
     * @notice Mints an amount of R tokens using the default hat
     */
    function mintRTokens(uint256 amount) private {
        IERC20 token = rtoken.token();
        require(
            token.transferFrom(msg.sender, address(this), amount),
            'Token transfer failed'
        );
        require(token.approve(address(rtoken), amount), 'Token approve failed');
        require(rtoken.mintWithSelectedHat(amount, hatID));
    }

    /**
     * @notice Mints synthetic tokens with the available margin
     */
    function mintSynTokens(uint256 margin)
        private
    {
        (int256 price, ) = derivative.getUpdatedUnderlyingPrice();
        rtoken.approve(address(derivative), margin);
        // no need to send short margin to mint long margin worth of tokens
        derivative.depositAndCreateTokens(
            margin,
            takeFactor(margin, uint256(price < 0 ? 0 : price))
        );
    }

    function takePercentage(uint256 value, uint256 percentage)
        private
        pure
        returns (uint256)
    {
        return value.mul(percentage).div(UINT_FP_SCALING_FACTOR);
    }

    function takeFactor(uint256 value, uint256 factor)
        private
        pure
        returns (uint256)
    {
        return value.mul(UINT_FP_SCALING_FACTOR).div(factor);
    }
}
