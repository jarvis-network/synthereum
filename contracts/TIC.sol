pragma solidity >=0.5.14 <0.7.0;
pragma experimental ABIEncoderV2;

// prevent conflict with RToken declarations
import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20, RToken} from "@rtoken/contracts/contracts/RToken.sol";
import {TokenizedDerivative} from "protocol/core/contracts/tokenized-derivative/TokenizedDerivative.sol";
import {TokenizedDerivativeCreator} from "protocol/core/contracts/tokenized-derivative/TokenizedDerivativeCreator.sol";

/**
 * @title Token Issuer Contract
 * @notice Collects margin, issues synthetic assets, and distributes accrued interest
 * @dev Margin currency is sent to an `RToken` and used as collateral for a
 *      `TokenizedDerivative` synthetic asset
 */
contract TIC is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 private constant INT_MAX = 2**255 - 1;
    uint256 private constant UINT_FP_SCALING_FACTOR = 1e18;

    uint256 private supportedMove;
    TokenizedDerivative public derivative;
    RToken public rtoken;
    address private provider;
    uint256 private hatID;

    /**
     * @notice Margin currency must be a rtoken
     * @dev TIC creates a new derivative so it is set as the sponsor
     */
    constructor(
        TokenizedDerivativeCreator derivativeCreator,
        TokenizedDerivativeCreator.Params memory params,
        address _provider
    )
        public
    {
        // stack error occurs when trying to get params from an existing
        // derivative, instead we create a new derivative and get the supported
        // move from the initial params.
        supportedMove = params.supportedMove;
        rtoken = RToken(params.marginCurrency);
        provider = _provider;

        address derivativeAddress = derivativeCreator
            .createTokenizedDerivative(params);
        derivative = TokenizedDerivative(derivativeAddress);

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
    function mint(uint256 amount) external nonReentrant {
        // get margin required for user's deposit
        uint256 newMargin = takePercentage(amount, supportedMove);

        require(newMargin <= INT_MAX);
        require(
            derivative.calcExcessMargin() >= int256(newMargin),
            'Insufficient margin'
        );

        // mint r tokens for derivative margin
        mintRTokens(amount);

        // mint synthetic asset with margin from user and provider
        uint256 tokensMinted = mintSynTokens(amount);

        // transfer synthetic asset to the user
        require(derivative.transfer(msg.sender, tokensMinted));
    }

    /**
     * @notice Liquidity provider supplies margin to the TIC to collateralize user deposits
     * @notice Requires authorization to transfer the margin currency
     * @param amountToDeposit The amount of margin supplied
     */
    function deposit(uint256 amountToDeposit) external payable onlyProvider {
        // mint r tokens for derivative margin
        mintRTokens(amountToDeposit);

        // deposit margin so users can mint synthetic assets
        require(rtoken.approve(address(derivative), amountToDeposit));
        derivative.deposit(amountToDeposit);
    }

    /**
     * @notice Redeem a user's SynFiat tokens for margin currency
     * @notice Requires authorization to transfer the SynFiat tokens
     * @dev Because of rtoken's Compound allocation strategy, redeeming an
     *      extremely tiny amount of tokens will cause a "redeemTokens zero"
     *      error from the cToken contract.
     * @param tokensToRedeem The amount of tokens to redeem
     */
    function redeemTokens(uint256 tokensToRedeem) external {
        require(tokensToRedeem > 0);
        require(derivative.balanceOf(msg.sender) >= tokensToRedeem);

        require(
            derivative.transferFrom(msg.sender, address(this), tokensToRedeem),
            'Token transfer failed'
        );
        require(
            derivative.approve(address(derivative), tokensToRedeem),
            'Token approve failed'
        );


        uint256 balance = rtoken.balanceOf(address(this));

        derivative.redeemTokens(tokensToRedeem);

        uint256 marginToRedeem = rtoken.balanceOf(address(this)) - balance;

        require(marginToRedeem > 0, "Redeemed tokens have zero value");
        require(rtoken.redeemAndTransfer(msg.sender, marginToRedeem));
    }

    /**
     * @notice Withdraw the excess short margin supplied by the provider
     * @param amount The amount of short margin to withdraw
     */
    function withdraw(uint256 amount) external onlyProvider {
        derivative.withdraw(amount);
        require(rtoken.redeemAndTransfer(msg.sender, amount));
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
     * @notice Get the collateral token
     * @return The ERC20 collateral token
     */
    function token() external view returns (IERC20) {
        return rtoken.token();
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
    function mintSynTokens(uint256 margin) private returns (uint256) {
        require(rtoken.approve(address(derivative), margin));

        (int256 price, ) = derivative.getUpdatedUnderlyingPrice();
        uint256 tokensToMint = takeFactor(
            margin,
            uint256(price < 0 ? 0 : price)
        );

        // no need to send short margin to mint long margin worth of tokens
        derivative.depositAndCreateTokens(margin, tokensToMint);

        return tokensToMint;
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
