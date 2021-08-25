// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract FixedRateWrapper is ERC20 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // Precision for math operations
  uint256 public constant PRECISION = 1e18;

  // The synthetic token to which the legacy currency is pegged
  IERC20 public immutable synth;

  // The rate at which the conversion happens
  uint256 public rate;

  // A variable to track total deposited amount of synthetic tokens
  uint256 public total_deposited;

  /** @notice Constructs the ERC20 contract and sets the immutable variables
   * @param _token - The synthetic token to which the legacy currency is pegged
   * @param _rate - The rate at which the conversion happens
   * @param _name - The name of the synthetic legacy currency token
   * @param _symbol - The symbol of the synthetic legacy currency token
   */
  constructor(
    IERC20 _token,
    uint256 _rate,
    string memory _name,
    string memory _symbol
  ) public ERC20(_name, _symbol) {
    synth = _token;
    rate = _rate;
  }

  /** @notice - An internal function which mints new fixedRate tokens according to the rate with it's peg synth
   * @param _amount - The amount of synthetic tokens the user wants to exchange
   */
  function wrap(uint256 _amount, address recipient)
    internal
    returns (uint256 amountTokens)
  {
    amountTokens = _amount.mul(rate).div(PRECISION);
    total_deposited = total_deposited.add(_amount);
    _mint(recipient, amountTokens);
  }

  /** @notice - A internal function which burns fixedRate tokens releasing peg synthetic tokens to a recipient
   * @param _amount - The amount of legacy synthetic tokens the user wants to deposit and burn
   */
  function unwrap(uint256 _amount, address recipient)
    internal
    returns (uint256 amountTokens)
  {
    require(balanceOf(msg.sender) >= _amount, 'Not enought tokens to unwrap');
    amountTokens = total_deposited.mul(_amount).div(totalSupply());
    _burn(msg.sender, _amount);
    total_deposited = total_deposited.sub(amountTokens);
    synth.safeTransfer(recipient, amountTokens);
  }
}