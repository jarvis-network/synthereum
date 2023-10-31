// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {StandardAccessControlEnumerable} from '../../common/roles/StandardAccessControlEnumerable.sol';
import {ConverterActivator} from './ConverterActivator.sol';

/**
 * @title A contract for depositing JARVIS and receiving WRAPPER 1:1
 */
contract JarvisToWrapperConverter is
  StandardAccessControlEnumerable,
  ConverterActivator
{
  using SafeERC20 for IERC20;

  IERC20 public immutable JARVIS;
  IERC20 public immutable WRAPPER;

  uint256 internal totalDepositedAmount;

  event JarvisMigrated(address indexed sender, uint256 jarvisAmount);
  event Withdrawn(uint256 indexed amount, address indexed recipient);

  /**
   * @param jarvis the address of the JARVIS token
   * @param wrapper the address of the WRAPPER token
   * @param roles input roles
   */
  constructor(
    IERC20 jarvis,
    IERC20 wrapper,
    Roles memory roles
  ) {
    // we can add checks on the addresses passed
    JARVIS = jarvis;
    WRAPPER = wrapper;

    _setAdmin(roles.admin);
    _setMaintainer(roles.maintainer);
  }

  /**
   * @dev sets the block number at which the migration will be opened
   * @dev set to 0 to interrupt migration
   * @param blockNumber starting block number
   */
  function setActivationBlock(uint256 blockNumber) external onlyMaintainer {
    _setActivationBlock(blockNumber);
  }

  /**
   * @dev withdraws an amount of WRAPPER from the contract
   * @param amount amount of WRAPPER to withdraw
   */
  function withdrawWRAPPER(uint256 amount) external onlyMaintainer {
    WRAPPER.safeTransfer(msg.sender, amount);
    emit Withdrawn(amount, msg.sender);
  }

  /**
   * @dev executes the migration from JARVIS to WRAPPER. Users need to give allowance to this contract to transfer JARVIS before executing
   * this transaction.
   * @param amount the amount of JARVIS to be migrated
   */
  function migrateFromJARVIS(uint256 amount) external onlyActive {
    totalDepositedAmount += amount;

    JARVIS.transferFrom(msg.sender, address(this), amount);
    WRAPPER.safeTransfer(msg.sender, amount);

    emit JarvisMigrated(msg.sender, amount);
  }

  function getTotalDepositedAmount() external view returns (uint256) {
    return totalDepositedAmount;
  }
}
