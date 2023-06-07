// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IDebtToken} from './interfaces/IDebtToken.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {StandardAccessControlEnumerable} from '../common/roles/StandardAccessControlEnumerable.sol';
import {ERC20Permit} from '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';

contract DebtToken is
  IDebtToken,
  ReentrancyGuard,
  StandardAccessControlEnumerable,
  ERC20Permit
{
  using SafeERC20 for IERC20;

  IERC20 private immutable jFiat;
  uint256 private immutable capAmount;

  uint256 private donatedAmount;
  uint256 private bondedAmount;
  uint256 private withdrawnAmount;

  constructor(
    IERC20 _jFiat,
    uint256 _capAmount,
    string memory _tokenName,
    string memory _tokenSymbol,
    Roles memory _roles
  ) ERC20Permit(_tokenName) ERC20(_tokenName, _tokenSymbol) {
    jFiat = _jFiat;
    require(_capAmount > 0, 'No cap set');
    capAmount = _capAmount;
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
    require(
      jFiat.balanceOf(address(this)) + withdrawnAmount + _amount <= capAmount,
      'Cap supply reached'
    );
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
   * @notice Only maintainer can call this function
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

  /**
   * @notice Returns address of the synthetic token associated to the debt token
   * @return Address of the synthetic token
   */
  function jAsset() external view returns (address) {
    return address(jFiat);
  }

  /**
   * @notice Returns the max amount of donated and bonded j-asset
   * @return Max balance of donated and bonded j-asset
   */
  function cap() external view returns (uint256) {
    return capAmount;
  }

  /**
   * @notice Returns balance of the synthetic token holded by the debt-token
   * @return Balance of the synthetic token holded
   */
  function jFiatBalance() external view returns (uint256) {
    return jFiat.balanceOf(address(this));
  }

  /**
   * @notice Returns balance of the synthetic token donated by users
   * @return Balance of the synthetic token donated
   */
  function donated() external view returns (uint256) {
    return jFiat.balanceOf(address(this)) + withdrawnAmount - bondedAmount;
  }

  /**
   * @notice Returns balance of the synthetic token bonded by users
   * @return Balance of the synthetic token bonded
   */
  function bonded() external view returns (uint256) {
    return bondedAmount;
  }

  /**
   * @notice Returns balance of the synthetic token withdrawn by the maintainer
   * @return Balance of the synthetic token withdrawn
   */
  function withdrawn() external view returns (uint256) {
    return withdrawnAmount;
  }
}
