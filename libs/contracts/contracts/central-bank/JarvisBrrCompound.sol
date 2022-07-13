// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.9;

import {IJarvisBrrMoneyMarket} from './interfaces/IJarvisBrrMoneyMarket.sol';
import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {ICErc20} from './interfaces/ICErc20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

// storageless contract to be used as delegate call by JarvisBRR to deposit the minted jSynth into a money market
contract JarvisBrrCompound is IJarvisBrrMoneyMarket {
  using SafeERC20 for IMintableBurnableERC20;
  using SafeERC20 for IERC20;

  function deposit(
    IMintableBurnableERC20 jSynthAsset,
    uint256 amount,
    bytes calldata extraArgs,
    bytes calldata implementationArgs
  ) external override returns (uint256 tokensOut) {
    require(jSynthAsset.balanceOf(address(this)) >= amount, 'Wrong balance');

    // initialise compound interest token
    address cTokenAddress = abi.decode(implementationArgs, (address));
    ICErc20 cToken = ICErc20(cTokenAddress);
    uint256 cTokenBalanceBefore = cToken.balanceOf(address(this));

    // approve and deposit underlying
    jSynthAsset.safeIncreaseAllowance(cTokenAddress, amount);
    uint256 success = cToken.mint(amount);
    require(success == 0, 'Failed mint');

    // calculate the cTokens out
    uint256 cTokenBalanceAfter = cToken.balanceOf(address(this));
    tokensOut = cTokenBalanceAfter - cTokenBalanceBefore;
  }

  function withdraw(
    IMintableBurnableERC20 jSynthAsset,
    uint256 jSynthAmount,
    bytes calldata extraArgs,
    bytes calldata implementationArgs
  ) external override returns (uint256 jSynthOut) {
    address cTokenAddr = abi.decode(implementationArgs, (address));
    // initialise compound interest token
    ICErc20 cToken = ICErc20(cTokenAddr);

    // redeem underlying - internally fails with an invalid amount
    cToken.redeemUnderlying(jSynthAmount);

    jSynthOut = jSynthAmount;
  }

  function getTotalBalance(
    address jSynth,
    bytes calldata args,
    bytes calldata implementationArgs
  ) external override returns (uint256 totalJSynth) {
    ICErc20 cToken = ICErc20(abi.decode(implementationArgs, (address)));
    totalJSynth = cToken.balanceOfUnderlying(msg.sender);
  }
}
