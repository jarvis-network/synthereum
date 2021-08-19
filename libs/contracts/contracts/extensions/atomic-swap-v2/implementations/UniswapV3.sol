// SPDX-License-Identifier: MIT

pragma solidity >=0.7.5;
pragma abicoder v2;

import '../Base.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  ISynthereumRegistry
} from '../../../core/registries/interfaces/IRegistry.sol';

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

contract UniV3AtomicSwap is BaseAtomicSwap {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  ISwapRouter public router;
  ISynthereumFinder public synthereumFinder;

  constructor(ISynthereumFinder _synthereum, ISwapRouter _uniV3Router) {
    router = _uniV3Router;
    synthereumFinder = _synthereum;
  }

  receive() external payable {}

  function swapToCollateralAndMint(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external returns (uint256 amountOut) {
    // TODO in interface
    uint24 fee = 3000;

    IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
    require(
      address(collateralInstance) == tokenSwapPath[tokenSwapPath.length - 1],
      'Wrong collateral instance'
    );
    IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);

    // TODO assumes only one hop (ERC20 - USDC)
    if (isExactInput) {
      // get input funds from caller
      inputTokenInstance.safeTransferFrom(
        msg.sender,
        (address(this), amountSpecified)
      );

      //approve router to swap tokens
      inputTokenInstance.safeIncreaseAllowance(
        address(router),
        amountSpecified
      );

      // swap to collateral token into this wallet
      ISwapRouter.ExactInputSingleParams memory params =
        ISwapRouter.ExactInputSingleParams(
          tokenSwapPath[0],
          tokenSwapPath[1],
          fee,
          address(this),
          mintParams.expiration,
          amountSpecified,
          minOutOrMaxIn,
          0
        );

      // TODO refundEth
      uint256 collateralOut = router.exactInputSingle(params);

      // mint jSynth to mintParams.recipient (supposedly msg.sender)
      // returns the output amount
      mintParams.collateralAmount = collateralOut;
      (amountOut, ) = synthereumPool.mint(mintParams);
    } else {
      // pull the max input tokens allowed to spend
      inputTokenInstance.safeTransferFrom(
        msg.sender,
        address(this),
        minOutOrMaxIn
      );

      // approve router to swap tokens
      inputTokenInstance.safeApprove(address(router), minOutOrMaxIn);

      // swap to collateral token into this wallet
      ISwapRouter.ExactOutputSingleParams memory params =
        ISwapRouter.ExactOutputSingleParams(
          tokenSwapPath[0],
          tokenSwapPath[1],
          fee,
          address(this),
          mintParams.expiration,
          amountSpecified,
          minOutOrMaxIn,
          0
        );

      uint256 inputTokenUsed = router.exactOutputSingle(params);

      // refund leftover tokens
      if (minOutOrMaxIn > inputTokenUsed) {
        inputTokenInstance.safeTransfer(
          msg.sender,
          minOutOrMaxIn.sub(inputTokenUsed)
        );
      }

      // mint jSynth to mintParams.recipient (supposedly msg.sender)
      // returns the output amount
      mintParams.collateralAmount = amountSpecified;
      (amountOut, ) = synthereumPool.mint(mintParams);
    }
  }

  // TODO assumes only one hop (USDC - ERC20)
  function redeemCollateralAndSwap(
    bool isExactInput,
    uint256 amountSpecified,
    address[] memory tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams,
    address recipient
  ) external returns (uint256) {
    // TODO in interface
    uint24 fee = 3000;

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
      numTokens
    );
    redeemParams.recipient = address(this);
    (uint256 collateralOut, ) = synthereumPool.redeem(redeemParams);

    if (isExactInput) {
      // approve router to swap tokens
      collateralInstance.safeIncreaseAllowance(address(router), collateralOut);

      // swap to erc20 token into recipient wallet
      ISwapRouter.ExactInputSingleParams memory params =
        ISwapRouter.ExactInputSingleParams(
          tokenSwapPath[0],
          tokenSwapPath[1],
          fee,
          recipient,
          redeemParams.expiration,
          collateralOut,
          minOutOrMaxIn,
          0
        );

      // TODO refundEth
      return router.exactInputSingle(params);
    } else {
      // approve router to swap tokens
      collateralInstance.safeApprove(address(router), collateralOut);

      // swap to collateral token into recipient wallet
      ISwapRouter.ExactOutputSingleParams memory params =
        ISwapRouter.ExactOutputSingleParams(
          tokenSwapPath[0],
          tokenSwapPath[1],
          fee,
          recipient,
          redeemParams.expiration,
          amountSpecified,
          collateralOut,
          0
        );

      uint256 inputTokensUsed = router.exactOutputSingle(params);

      // refund leftover input (collateral) tokens
      if (collateralOut > inputTokensUsed) {
        inputTokenInstance.safeTransfer(
          msg.sender,
          collateralOut.sub(inputTokensUsed)
        );
      }

      return inputTokensUsed;
    }
  }

  function checkSynthereumPool(ISynthereumPoolOnChainPriceFeed synthereumPool)
    internal
    view
    returns (IERC20 collateralInstance)
  {
    ISynthereumRegistry poolRegistry =
      ISynthereumRegistry(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.PoolRegistry
        )
      );
    string memory synthTokenSymbol = synthereumPool.syntheticTokenSymbol();
    collateralInstance = synthereumPool.collateralToken();
    uint8 version = synthereumPool.version();
    require(
      poolRegistry.isDeployed(
        synthTokenSymbol,
        collateralInstance,
        version,
        address(synthereumPool)
      ),
      'Pool not registred'
    );
  }
}
