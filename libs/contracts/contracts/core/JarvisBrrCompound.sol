// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.9;

import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {IJarvisBrrMoneyMarket} from './interfaces/IJarvisBrrMoneyMarket.sol';
import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {ICErc20} from './interfaces/ICErc20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';

// storageless contract to be used as delegate call by JarvisBRR to deposit the minted jSynth into a money market
contract JarvisBrrCompound is IJarvisBrrMoneyMarket {
  using SafeERC20 for IMintableBurnableERC20;
  using SafeERC20 for IERC20;
  using PreciseUnitMath for uint256;

  function deposit(
    IMintableBurnableERC20 jSynthAsset,
    uint256 amount,
    bytes memory extraArgs,
    bytes memory implementationArgs
  ) external override returns (uint256 tokensOut) {
    require(jSynthAsset.balanceOf(address(this)) == amount, 'Wrong balance');

    // initialise compound interest token
    address cTokenAddress = abi.decode(implementationArgs, (address));

    // scale the amount in compound decimals (8)
    uint256 scaledAmount = amount.div(10**10);

    // approve and deposit underlying
    jSynthAsset.safeIncreaseAllowance(cTokenAddress, amount);
    tokensOut = ICErc20(cTokenAddress).mint(scaledAmount);

    // scale up the tokens out in 18 decimals
    tokensOut = tokensOut.mul(10**10);
  }

  function withdraw(
    IMintableBurnableERC20 jSynthAsset,
    uint256 jSynthAmount,
    bytes memory extraArgs,
    bytes memory implementationArgs
  ) external override returns (uint256 jSynthOut) {
    address cTokenAddr = abi.decode(implementationArgs, (address));
    // initialise compound interest token
    ICErc20 cToken = ICErc20(cTokenAddr);

    // obtain cToken amount conversion
    uint256 cTokenAmountScaled =
      jSynthAmount.div(cToken.exchangeRateCurrent()).div(10**10);

    require(
      IERC20(cTokenAddr).balanceOf(address(this)) >= cTokenAmountScaled,
      'Wrong balance'
    );

    // redeem underlying
    cToken.redeem(cTokenAmountScaled);

    jSynthOut = cTokenAmountScaled;
  }

  function getTotalBalance(
    address jSynth,
    bytes memory args,
    bytes memory implementationArgs
  ) external override returns (uint256 totalJSynth) {
    ICErc20 cToken = ICErc20(abi.decode(implementationArgs, (address)));
    totalJSynth = cToken.balanceOfUnderlying(msg.sender);
  }
}
