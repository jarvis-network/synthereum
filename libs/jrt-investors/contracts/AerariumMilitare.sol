// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract AerariumMilitare is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // The start time of the ERC20 token distribution
  uint256 public immutable startTime;
  // The end time for the ERC20 token distribution
  uint256 public immutable endTime;
  // The lock period for the ERC20 token
  uint256 public immutable lockTime;
  // The ERC20 token address passed in the constructor
  IERC20 public immutable token;
  // The total amount of tokens to be distributed
  uint256 public totalTokenAmount;
  // A mapping of each investor address to a specific amount
  mapping(address => uint256) public userTotalAmount;
  // A mapping of each investor address to the amount of JRT already claimed
  mapping(address => uint256) public claimedAmount;

  /** @dev Constructor when deploying the smart contract
   * @param _token - The address of the ERC20 token
   * @param _startTime - Setting the start time of the distribution
   * @param _endTime - Setting the end time of the distribution
   */
  constructor(
    IERC20 _token,
    uint256 _startTime,
    uint256 _endTime
  ) {
    require(_endTime > _startTime, 'End time must be after start time');
    require(
      _startTime > block.timestamp,
      'Start time must be after actual time'
    );
    token = _token;
    startTime = _startTime;
    endTime = _endTime;
    lockTime = _endTime - _startTime;
  }

  /** @dev - A function which can be called only by owner and stores the investor addresses and corresponding tokens to be distributed
   * @param addresses - An array of all the investors addresses
   * @param amounts - An array of the amounts to be distributed per investor
   */
  function addInvestors(
    address[] calldata addresses,
    uint256[] calldata amounts
  ) public onlyOwner {
    require(
      block.timestamp < startTime,
      'Current time should be before the start of the distribution'
    );
    require(
      addresses.length == amounts.length,
      'Number of addresses and amounts does not match'
    );
    uint256 totalActualAmount = 0;
    for (uint256 i = 0; i < addresses.length; i++) {
      require(
        addresses[i] != address(0),
        'Provided address can not be the 0 address'
      );
      require(userTotalAmount[addresses[i]] == 0, 'Investor already inserted');
      uint256 userAmount = amounts[i];
      userTotalAmount[addresses[i]] = userAmount;
      totalActualAmount = totalActualAmount.add(userAmount);
    }
    uint256 newTotalAmount = totalTokenAmount.add(totalActualAmount);
    totalTokenAmount = newTotalAmount;
    require(
      token.balanceOf(address(this)) >= newTotalAmount,
      'The balance of the contract is not enough'
    );
  }

  /** @dev - A function to be called by the frontend to check the current claimable ERC20 token
   * @param investor - Address of investor about which check the claimable tokens
   * @return Claimable tokens
   */
  function claimableJRT(address investor) external view returns (uint256) {
    uint256 totalAmount = userTotalAmount[investor];
    uint256 timePassed = block.timestamp <= endTime
      ? block.timestamp.sub(startTime)
      : endTime.sub(startTime);
    return
      timePassed.mul(totalAmount).div(lockTime).sub(claimedAmount[investor]);
  }

  /** @dev - The function which is called when an investor wants to claim unlocked ERC20 tokens with linear proportionality
   */
  function claim() external {
    require(block.timestamp < endTime, 'The end time has passed');
    uint256 totalAmount = userTotalAmount[msg.sender];
    uint256 timePassed = block.timestamp.sub(startTime);
    uint256 amount = timePassed.mul(totalAmount).div(lockTime).sub(
      claimedAmount[msg.sender]
    );
    claimedAmount[msg.sender] = claimedAmount[msg.sender].add(amount);
    token.safeTransfer(msg.sender, amount);
  }

  /** @dev - A function which calls internal _liquidate function to transfer any tokens left on the contract to investors after the endTime has passed
   * @param investors - Array of investors addresses to liquidate
   */
  function liquidate(address[] calldata investors) external {
    require(block.timestamp >= endTime, 'The end time has not passed');
    for (uint256 i = 0; i < investors.length; i++) {
      address investor = investors[i];
      uint256 availableTokens = userTotalAmount[investor];
      uint256 claimedTokens = claimedAmount[investor];
      require(
        availableTokens != 0 && availableTokens != claimedTokens,
        'no tokens to be distributed for an investor'
      );
      _liquidate(investor, availableTokens, claimedTokens);
    }
  }

  /** @dev - Internal function which performs the transfer of tokens from the smart contract to the investor after endTime
   * updates claimedAmount to be equal to the totalAmount the investor should receive
   */
  function _liquidate(
    address investor,
    uint256 availableTokens,
    uint256 claimedTokens
  ) internal {
    token.safeTransfer(investor, availableTokens.sub(claimedTokens));
    claimedAmount[investor] = availableTokens;
  }
}
