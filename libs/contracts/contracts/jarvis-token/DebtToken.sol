// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {
  StandardAccessControlEnumerable
} from '../common/roles/StandardAccessControlEnumerable.sol';
import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';

contract DebtToken is ERC20, ReentrancyGuard, StandardAccessControlEnumerable {
  using PreciseUnitMath for uint256;
  using SafeERC20 for IERC20;
  using Address for address;

  address public immutable jFiat;

  uint256 public donated;
  uint256 public bonded;
  uint256 public withdrawn;

  event Donated(address indexed user, uint256 amount);
  event Bonded(address indexed user, uint256 amount);
  event Withdrawn(uint256 amount, address indexed recipient);
  event Deposited(uint256 amount, bool burn);

  constructor(
    address _jFiat,
    string memory _tokenName,
    string memory _tokenSymbol,
    Roles memory _roles
  ) public ERC20(_tokenName, _tokenSymbol) {
    jFiat = _jFiat;
    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  // allows to donate or bond jFiat
  function deposit(uint256 amount, bool isDonation) external nonReentrant {
    // pull user jFiat into this contract
    IERC20(jFiat).safeTransferFrom(msg.sender, address(this), amount);

    if (isDonation) {
      // burn user jFiat
      IMintableBurnableERC20(jFiat).burn(amount);
      donated += amount;
      emit Donated(msg.sender, amount);
    } else {
      bonded += amount;

      // mint debt token to user
      _mint(msg.sender, amount);
      emit Bonded(msg.sender, amount);
    }
  }

  // maintainer to withdraw bonded jFiat into a recipient
  function withdrawBondedJFiat(uint256 amount, address recipient)
    external
    onlyMaintainer
  {
    IERC20(jFiat).transfer(recipient, amount);
    withdrawn += amount;
    emit Withdrawn(amount, recipient);
  }

  // maintainer to deposit previously withdrawn jFiat with possibility to burn
  function depositBondedJFiat(uint256 amount, bool burn)
    external
    onlyMaintainer
  {
    // pull jFiat into this contract
    IERC20(jFiat).safeTransferFrom(msg.sender, address(this), amount);

    if (burn) {
      IMintableBurnableERC20(jFiat).burn(amount);
    }

    withdrawn -= amount;
    emit Deposited(amount, burn);
  }
}
