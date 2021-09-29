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

  ISwapRouter router;
  ISynthereumFinder synthereumFinder;

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

    // TODO exact input case
    if (isExactInput) {
      IERC20 collateralInstance = checkSynthereumPool(synthereumPool);
      require(
        address(collateralInstance) == tokenSwapPath[tokenSwapPath.length - 1],
        'Wrong collateral instance'
      );
      IERC20 inputTokenInstance = IERC20(tokenSwapPath[0]);

      // get input funds from caller
      inputTokenInstance.safeTransferFrom(
        msg.sender,
        (address(this), amountSpecified)
      );

      //approve router to swap tokens
      inputTokenInstance.safeIncreaseAllowance(
        address(ISwapRouter),
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
      uint256 collateralOut = ISwapRouter.exactInputSingle(params);

      // mint jSynth to mintParams.recipient (supposedly msg.sender)
      // returns the output amount
      mintParams.collateralAmount = collateralOut;
      (amountOut, ) = synthereumPool.mint(mintParams);
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
