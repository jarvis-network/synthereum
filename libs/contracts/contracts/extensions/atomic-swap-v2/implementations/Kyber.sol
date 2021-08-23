// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;
pragma abicoder v2;

import '../Base.sol';
import '../interfaces/IKyberProxy.sol';

contract KyberAtomicSwap is BaseAtomicSwap {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IKyberNetworkProxy kyberProxy;
  uint256 public platformFeeBps;
  address payable public platformFeeCollector;

  constructor(
    ISynthereumFinder _synthereum,
    IKyberNetworkProxy _kyberProxy,
    address _wethAddress,
    uint256 _platformFeeBps,
    address _platformFeeCollector
  ) BaseAtomicSwap(_wethAddress, _synthereum) {
    kyberProxy = _kyberProxy;
    platformFeeBps = _platformFeeBps;
    platformFeeCollector = _platformFeeCollector;
  }

  receive() external payable {}

  /// @notice kyber only supports exact input
  function swapToCollateralAndMint(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut) {
    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );
    IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);

    if (msg.value > 0) {
      // eth as input
      tokenSwapPath[0] = WETH_ADDRESS;
      amountSpecified = msg.value;
    } else {
      // erc20 as input - get funds from caller
      inputTokenInstance.safeTransferFrom(
        msg.sender,
        address(this),
        amountSpecified
      );

      // approve kyber router to swap
      inputTokenInstance.safeIncreaseAllowance(
        address(kyberProxy),
        amountSpecified
      );
    }

    // swap to collateral token into this wallet
    // TODO hint
    uint256 collateralOut =
      kyberProxy.tradeWithHintAndFee{value: msg.value}(
        inputTokenInstance,
        amountSpecified,
        collateralInstance,
        address(this),
        minOutOrMaxIn,
        getConversionRate(
          inputTokenInstance,
          collateralInstance,
          amountSpecified
        ),
        platformFeeCollector,
        platformFeeBps,
        ''
      );

    // approve synthereum to pull collateral
    collateralInstance.safeIncreaseAllowance(
      address(synthereumPool),
      collateralOut
    );

    // mint jSynth to mintParams.recipient (supposedly msg.sender)
    // returns the output amount
    mintParams.collateralAmount = collateralOut;
    (amountOut, ) = synthereumPool.mint(mintParams);
  }

  // TODO assumes only one hop (USDC - ERC20/ETH)
  function redeemCollateralAndSwap(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address payable recipient
  ) external returns (uint256) {
    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[0],
      'Wrong collateral instance'
    );
    IERC20 outputTokenInstance =
      IERC20(tokenSwapPath[tokenSwapPath.length - 1]);
    IERC20 synthTokenInstance = synthereumPool.syntheticToken();

    // redeem USDC with jSynth into this contract
    synthTokenInstance.safeTransferFrom(
      msg.sender,
      address(this),
      redeemParams.numTokens
    );
    synthTokenInstance.safeIncreaseAllowance(
      address(synthereumPool),
      redeemParams.numTokens
    );
    redeemParams.recipient = address(this);
    (uint256 collateralOut, ) = synthereumPool.redeem(redeemParams);

    // approve kyber proxy to swap tokens
    collateralInstance.safeIncreaseAllowance(
      address(kyberProxy),
      collateralOut
    );

    // swap to erc20/eth into recipient wallet
    return
      kyberProxy.tradeWithHintAndFee(
        collateralInstance,
        amountSpecified,
        outputTokenInstance,
        recipient,
        minOutOrMaxIn,
        getConversionRate(
          collateralInstance,
          outputTokenInstance,
          amountSpecified
        ),
        platformFeeCollector,
        platformFeeBps,
        ''
      );
  }

  function getConversionRate(
    IERC20 inputToken,
    IERC20 outputToken,
    uint256 inputAmount
  ) public view returns (uint256) {
    return
      kyberProxy.getExpectedRateAfterFee(
        inputToken,
        outputToken,
        inputAmount,
        platformFeeBps,
        ''
      );
  }
}
