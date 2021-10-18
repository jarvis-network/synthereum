// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './Aureus.sol';
import './ElysianFields.sol';

contract AerariumSanctius is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for Aureus;
  using SafeERC20 for IERC20;

  // The reward token that will be used to redeem rewards at the end of the farming program
  Aureus public immutable rwdToken;
  // The endBlock after which rewards can be redeemable
  uint256 public immutable endBlock;
  // A timeout for withdraw after which the owner can withdraw any excess tokens left in the contract
  uint256 public immutable withdrawTimeout;
  // An array of structs holding information on each token that is deposited in the contract and will be distributed as reward at the end of the program
  IERC20[] public tokensHeld;
  // A mapping to track token amounts stored in the contract for each token in tokensHeld array
  mapping(IERC20 => uint256) public tokenAmounts;

  // A withdraw event emited on withdraw of rewards after the end of the program
  event Withdraw(address user, address token, uint256 amount);

  /** @dev - Constructor
   * @param _elysianFields - This is the address of the master contract used to farm the ERC20 token that will be used to unlock rewards from this contract
   * @param _owner - The address to which ownership of this contract will be passed in the constructor
   * @param _withdrawBlockTimeout - The timeout added after the end of the program after which the owner can withdraw any excess tokens left in this contract
   */
  constructor(
    ElysianFields _elysianFields,
    address _owner,
    uint256 _withdrawBlockTimeout
  ) {
    require(_withdrawBlockTimeout > 0, 'Withdraw timeout can not be set to 0');
    rwdToken = _elysianFields.rwdToken();
    endBlock = _elysianFields.endBlock();
    withdrawTimeout = _elysianFields.claimTimeout().add(_withdrawBlockTimeout);
    transferOwnership(_owner);
  }

  /** @dev - This function allows the owner to add tokens to this contract that can be distributed at the end of the farming program
   * @param _token - The address of the ERC20 token that will be deposited in the contract
   * @param _amount - The amount of ERC20 tokens that will be transferred from the owner to this contract
   */
  function addTokens(IERC20 _token, uint256 _amount) external onlyOwner {
    require(
      block.number <= endBlock,
      'The end time of the program is reached!'
    );
    _token.safeTransferFrom(msg.sender, address(this), _amount);
    if (tokenAmounts[_token] == 0) {
      tokensHeld.push(_token);
      tokenAmounts[_token] = _amount;
    } else {
      tokenAmounts[_token] = tokenAmounts[_token].add(_amount);
    }
  }

  /** @dev - Claim function which is called by the user to claim their share of reward tokens after the end of the farming program
   * @param _rwdAmount - The amount of reward tokens that the user accumulated and will be burned to unlock the tokens held in this contract
   */
  function claim(uint256 _rwdAmount) external {
    require(
      block.number > endBlock,
      'The end time of the program is not reached!'
    );
    rwdToken.safeTransferFrom(msg.sender, address(this), _rwdAmount);
    uint256 percentage = (_rwdAmount.mul(1e18)).div(rwdToken.cap());
    rwdToken.burn(_rwdAmount);
    _withdraw(percentage);
  }

  /** @dev - A function to withdraw any excess tokens left in this contract after the program has ended and the timeout has expired
   * @param _receiver - The address to which the remaining excess tokens will be sent
   */
  function withdrawExcess(address _receiver) external onlyOwner {
    require(
      block.number > withdrawTimeout,
      'The current withdraw period has not finished'
    );
    for (uint256 i = 0; i < tokensHeld.length; i++) {
      tokensHeld[i].safeTransfer(
        _receiver,
        tokensHeld[i].balanceOf(address(this))
      );
    }
  }

  /** @dev - A function to check the length of the array of structs
   */
  function tokensHeldLength() external view returns (uint256) {
    return tokensHeld.length;
  }

  /** @dev - An internal withdraw function which transfers a percentage of each ERC20 held in this contract to the user. It is called within the claim funcion
   * @param _percentage - The percentage is calculated based on the reward token amount the user sent to be burned. It is calculated and passed within the claim function
   * emits a Withdraw event for each transfer of ERC20 tokens from this contract to the user
   */
  function _withdraw(uint256 _percentage) internal {
    for (uint256 i = 0; i < tokensHeld.length; i++) {
      uint256 currentAmount = tokenAmounts[tokensHeld[i]];
      uint256 _amount = currentAmount.mul(_percentage).div(1e18);
      tokensHeld[i].safeTransfer(msg.sender, _amount);
      emit Withdraw(msg.sender, address(tokensHeld[i]), _amount);
    }
  }
}
