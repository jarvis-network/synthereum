// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.9;

import {IJarvisBrrMoneyMarket} from '../interfaces/IJarvisBrrMoneyMarket.sol';
import {IPool} from '../../lending-module/interfaces/IAaveV3.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

// storageless contract to be used as delegate call by JarvisBRR to deposit the minted jSynth into a money market
contract JarvisBrrAave is IJarvisBrrMoneyMarket {
  using SafeERC20 for IMintableBurnableERC20;
  using SafeERC20 for IERC20;

  function deposit(
    IMintableBurnableERC20 _jSynthAsset,
    uint256 _amount,
    bytes calldata _extraArgs,
    bytes calldata _implementationArgs
  ) external override returns (uint256 tokensOut) {
    require(_jSynthAsset.balanceOf(address(this)) >= _amount, 'Wrong balance');
    (address moneyMarket, IERC20 interestToken) =
      interestBearingToken(address(_jSynthAsset), _extraArgs);

    uint256 aTokenBalanceBefore = interestToken.balanceOf(address(this));

    _jSynthAsset.safeIncreaseAllowance(moneyMarket, _amount);
    IPool(moneyMarket).supply(
      address(_jSynthAsset),
      _amount,
      address(this),
      uint16(0)
    );

    uint256 aTokenBalanceAfter = interestToken.balanceOf(address(this));

    tokensOut = aTokenBalanceAfter - aTokenBalanceBefore;
  }

  function withdraw(
    IMintableBurnableERC20 _jSynthAsset,
    uint256 _aTokensAmount,
    bytes calldata _extraArgs,
    bytes calldata _implementationArgs
  ) external override returns (uint256 jSynthOut) {
    (address moneyMarket, IERC20 interestToken) =
      interestBearingToken(address(_jSynthAsset), _extraArgs);

    require(
      interestToken.balanceOf(address(this)) >= _aTokensAmount,
      'Wrong balance'
    );

    uint256 jSynthBalanceBefore = _jSynthAsset.balanceOf(address(this));

    interestToken.safeIncreaseAllowance(moneyMarket, _aTokensAmount);
    IPool(moneyMarket).withdraw(
      address(_jSynthAsset),
      _aTokensAmount,
      address(this)
    );

    uint256 jSynthBalanceAfter = _jSynthAsset.balanceOf(address(this));

    jSynthOut = jSynthBalanceAfter - jSynthBalanceBefore;
  }

  function getTotalBalance(
    address _jSynth,
    bytes calldata _args,
    bytes calldata _implementationArgs
  ) external view override returns (uint256 totalJSynth) {
    (, IERC20 interestToken) = interestBearingToken(_jSynth, _args);
    totalJSynth = interestToken.balanceOf(msg.sender);
  }

  function interestBearingToken(address _jSynth, bytes memory _args)
    internal
    view
    returns (address moneyMarket, IERC20 token)
  {
    moneyMarket = abi.decode(_args, (address));
    token = IERC20(IPool(moneyMarket).getReserveData(_jSynth).aTokenAddress);
  }
}
