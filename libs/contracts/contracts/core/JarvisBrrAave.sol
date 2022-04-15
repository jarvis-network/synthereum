pragma solidity 0.8.9;

import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {IJarvisBrrMoneyMarket} from './interfaces/IJarvisBrrMoneyMarket.sol';
import {IPool} from '../lending-module/interfaces/IAaveV3.sol';
import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

// storageless contract to be used as delegate call by JarvisBRR to deposit the minted jSynth into a money market
contract JarvisBrrAave is IJarvisBrrMoneyMarket {
  using SafeERC20 for IMintableBurnableERC20;

  function deposit(
    IMintableBurnableERC20 jSynthAsset,
    uint256 amount,
    bytes memory extraArgs
  ) external override returns (uint256 tokensOut) {
    require(jSynthAsset.balanceOf(address(this)) == amount, 'Wrong balance');

    // aave deposit - approve
    address moneyMarket = abi.decode(extraArgs, (address));

    jSynthAsset.safeIncreaseAllowance(moneyMarket, amount);
    IPool(moneyMarket).deposit(
      address(jSynthAsset),
      amount,
      address(this),
      uint16(0)
    );

    tokensOut = amount;
  }
}
