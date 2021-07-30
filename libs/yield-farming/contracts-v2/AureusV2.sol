// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './interfaces/IRewardToken.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract Aureus is ERC20Capped, Ownable {
  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _cap
  ) ERC20(_name, _symbol) ERC20Capped(_cap) {}

  function burn(address sender, uint256 amount) external override {
    _burn(sender, amount);
  }

  function mint(address recipient, uint256 amount) public override onlyOwner {
    _mint(recipient, amount);
  }
}
