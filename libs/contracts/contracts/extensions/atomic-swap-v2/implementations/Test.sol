// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '../IAtomicSwapV2.sol';

contract TestImplementation {
  IAtomicSwapV2 public atomicSwapIface;

  // id is sha3(stringID) ie sha3('sushi'), sha3('uniV2') and so on
  // that means only one implementation for each specific dex can exist
  // on UI side, by fixing the identifiers string no fix needs to be done in case on implementations address change
  mapping(bytes32 => address) idToAddress;

  address admin;
  event Log(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed pool,
    ISynthereumPoolOnChainPriceFeed.MintParams lol
  );
  event Log2(ISynthereumPoolOnChainPriceFeed.MintParams mint);

  function swapToCollateralAndMint(
    bool isExactInput,
    uint256 amountSpecified,
    uint256 minOutOrMaxIn,
    address[] memory tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed synthereumPool,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) external returns (uint256 amountOut) {
    emit Log(
      isExactInput,
      amountSpecified,
      minOutOrMaxIn,
      tokenSwapPath,
      synthereumPool,
      mintParams
    );
    return 10;
  }

  function swap(ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams)
    external
    returns (uint256 amountOut)
  {
    emit Log2(mintParams);
    return 11;
  }
}
