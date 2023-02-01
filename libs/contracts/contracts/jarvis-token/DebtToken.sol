// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {
  StandardAccessControlEnumerable
} from '../common/roles/StandardAccessControlEnumerable.sol';
import {
  ERC20Permit
} from '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';

contract DebtToken is
  ReentrancyGuard,
  StandardAccessControlEnumerable,
  ERC20Permit
{
  using SafeERC20 for IERC20;

  IERC20 public immutable jFiat;

  uint256 private donatedAmount;
  uint256 private bondedAmount;
  uint256 private withdrawnAmount;

  event Donated(address indexed user, uint256 amount);
  event Bonded(address indexed user, uint256 amount);
  event Withdrawn(uint256 amount, address indexed recipient);

  constructor(
    IERC20 _jFiat,
    string memory _tokenName,
    string memory _tokenSymbol,
    Roles memory _roles
  ) ERC20Permit(_tokenName) ERC20(_tokenName, _tokenSymbol) {
    jFiat = _jFiat;
    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  /**
   * @notice Deposit j-asset in the debt token contract
   * @param _amount Amount of j-asset to deposit
   * @param _isDonation If true no debt-tokens are minted, if false 1:1
   */
  function depositJFiat(uint256 _amount, bool _isDonation)
    external
    nonReentrant
  {
    // pull user jFiat into this contract
    jFiat.safeTransferFrom(msg.sender, address(this), _amount);

    if (_isDonation) {
      donatedAmount += _amount;
      emit Donated(msg.sender, _amount);
    } else {
      bondedAmount += _amount;

      // mint debt token to user
      _mint(msg.sender, _amount);
      emit Bonded(msg.sender, _amount);
    }
  }

  /**
   * @notice Allow maintainer to withdraw jFiat into a recipient
   * @param _amount Amount of j-asset to withdraw
   * @param _recipient Address will receive j-asset
   */
  function withdrawJFiat(uint256 _amount, address _recipient)
    external
    onlyMaintainer
    nonReentrant
  {
    jFiat.transfer(_recipient, _amount);
    withdrawnAmount += _amount;
    emit Withdrawn(_amount, _recipient);
  }

  function jFiatBalance() external view returns (uint256) {
    return jFiat.balanceOf(address(this));
  }

  function donated() external view returns (uint256) {
    return jFiat.balanceOf(address(this)) + withdrawnAmount - bondedAmount;
  }

  function bonded() external view returns (uint256) {
    return bondedAmount;
  }

  function withdrawn() external view returns (uint256) {
    return withdrawnAmount;
  }
}
