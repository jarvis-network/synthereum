// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract FixedRateWrapper is ERC20 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 public constant PRECISION = 1e18;

  IERC20 public immutable synth;

  uint256 public immutable rate;

  mapping(address => uint256) public userFunds;

  constructor(
    IERC20 _token,
    uint256 _rate,
    string memory _name,
    string memory _symbol
  ) ERC20(_name, _symbol) {
    synth = _token;
    rate = _rate;
  }

  /* @notice - A public function to wrap synth token to another synth token based on a fixed conversion rate
   *  @param _amount - The amount of synthetic tokens to be wrapped
   */
  function wrap(uint256 _amount) public {
    uint256 amountTokens = _amount.mul(rate).div(PRECISION);
    synth.safeTransferFrom(msg.sender, address(this), _amount);
    userFunds[msg.sender] = userFunds[msg.sender].add(_amount);
    _mint(msg.sender, amountTokens);
  }

  function unwrap(uint256 _amount) public {
    require(balanceOf(msg.sender) >= _amount, 'Not enought tokens to unwrap');
    uint256 ratio = _amount.mul(PRECISION).div(balanceOf(msg.sender));
    uint256 amountTokens = userFunds[msg.sender].mul(ratio).div(PRECISION);
    _burn(msg.sender, _amount);
    userFunds[msg.sender] = userFunds[msg.sender].sub(amountTokens);
    synth.safeTransfer(msg.sender, amountTokens);
  }
}
