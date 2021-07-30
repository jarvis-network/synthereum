// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IRewardToken is IERC20 {
  function burn(address sender, uint256 amount) external;

  function mint(address recipient, uint256 amount) external;
}
