// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {PreciseUnitMath} from '../base/utils/PreciseUnitMath.sol';
import {
  StandardAccessControlEnumerable
} from '../common/roles/StandardAccessControlEnumerable.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';

contract jEurDebt is ERC20, ReentrancyGuard, StandardAccessControlEnumerable {
  using PreciseUnitMath for uint256;
  using SafeERC20 for IERC20;
  using Address for address;

  address public immutable jEuro;

  uint256 public donated;
  uint256 public bonded;
  uint256 public withdrawn;

  mapping(address => uint256) public liquidity;

  event Donated(address indexed user, uint256 amount);
  event Bonded(address indexed user, uint256 amount);

  constructor(address _jEuro, Roles memory _roles)
    public
    ERC20(_tokenName, _tokenSymbol)
  {
    jEuro = _jEuro;
    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  // TODO BURN FROM JEURO CONTRACT
  function deposit(uint256 amount, bool isDonation) external {
    if (isDonation) {
      _burn(msg.sender, amount);
      donated += amount;
      emit Donated(msg.sender, amount);
    } else {
      IERC20(jEuro).safeTransferFrom(msg.sender, address(this), amount);
      bonded += amount;
      _mint(msg.sender, amount);
      emit Bonded(msg.sender, amount);
    }
  }

  function withdrawBondedJEuro(uint256 amount) external onlyMaintainer {
    IERC20(jEuro).transfer(msg.sender, amount);
    withdrawn += amount;
  }

  function depositBondedJEuro(uint256 amount, bool burn)
    external
    onlyMaintainer
  {
    _burn(msg.sender, amount);
    withdrawn -= amount;
  }

  function addLiquidity(address token, uint256 amount) external onlyMaintainer {
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    liquidity[token] += amount;
  }

  function claimReward(address token, uint256 debtAmount)
    external
    onlyMaintainer
  {}
}
