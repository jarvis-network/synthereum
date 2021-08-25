pragma solidity >=0.7.5;
pragma abicoder v2;

import '../BaseAtomicSwap.sol';
import {IUniswapV2Router02} from './interfaces/IUniswapV2Router02.sol';

contract UniV2AtomicSwap is BaseAtomicSwap {
  IUniswapV2Router02 public router;

  constructor(
    ISynthereumFinder _synthereum,
    IUniswapV2Router02 _uniV2Router,
    address _wethAaddress
  ) BaseAtomicSwap(_wethAaddress, _synthereum) {
    router = _uniV2Router;
  }

  receive() external payable {}

  function swapToCollateralAndMint(
    bool isExactInput,
    uint256 exactAmount,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    bytes memory extraParams,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external payable returns (uint256 amountOut) {
    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );

    uint256 numberOfSwaps = tokenSwapPath.length - 1;
    uint256 collateralOut;
    if (isExactInput) {
      if (tokenSwapPath[0] == WETH_ADDRESS) {
        //swapExactETHForTokens into this wallet
        collateralOut = router.swapExactETHForTokens{value: msg.value}(
          minOutOrMaxIn,
          tokenSwapPath,
          address(this),
          mintParams.expiration
        )[numberOfSwaps];
      } else {
        //swapExactTokensForTokens into this wallet
        IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);

        inputTokenInstance.safeTransferFrom(
          msg.sender,
          address(this),
          exactAmount
        );
        inputTokenInstance.safeIncreaseAllowance(address(router), exactAmount);
        collateralOut = router.swapExactTokensForTokens(
          exactAmount,
          minOutOrMaxIn,
          tokenSwapPath,
          address(this),
          mintParams.expiration
        )[numberOfSwaps];
      }
    } else {
      uint256 inputAmountUsed;
      if (tokenSwapPath[0] == WETH_ADDRESS) {
        //swapETHForExactTokens
        minOutOrMaxIn = msg.value;

        uint256[] memory amountsOut =
          router.swapETHForExactTokens{value: msg.value}(
            exactAmount,
            tokenSwapPath,
            address(this),
            mintParams.expiration
          )[numberOfSwaps];

        inputAmountUsed = amountsOut[0];
        collateralOut = amountsOut[numberOfSwaps];

        // refund eventual eth leftover
        if (minOutOrMaxIn > inputAmountUsed) {
          (bool success, ) =
            msg.sender.call{value: minOutOrMaxIn.sub(inputAmountUsed)}('');
          require(success, 'Refund eth failed');
        }
      } else {
        //swapTokensForExactTokens
        IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);
        inputTokenInstance.safeTransferFrom(
          msg.sender,
          address(this),
          mintOutOrMaxIn
        );
        inputTokenInstance.safeIncreaseAllowance(
          address(router),
          minOutOrMaxIn
        );

        uint256[] memory amountsOut =
          router.swapTokensForExactTokens(
            exactAmount,
            minOutOrMaxIn,
            tokenSwapPath,
            address(this),
            mintParams.expiration
          );

        inputAmountUsed = amountsOut[0];
        collateralOut = amountsOut[numberOfSwaps];

        if (minOutOrMaxIn > inputAmountUsed) {
          inputTokenInstance.safeTransfer(
            msg.sender,
            minOutOrMaxIn.sub(inputAmountUsed)
          );
        }
      }
    }

    // mint jSynth
    collateralInstance.safeIncreaseAllowance(
      address(synthereumPool),
      collateralOut
    );
    mintParams.collateralAmount = collateralOut;
    (amountOut, ) = synthereumPool.mint(mintParams);
  }
}
