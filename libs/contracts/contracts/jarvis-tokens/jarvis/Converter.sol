// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';
import {StandardAccessControlEnumerable} from '../../common/roles/StandardAccessControlEnumerable.sol';
import {ConverterActivator} from './ConverterActivator.sol';

/**
 * @title A contract for depositing JRT and receiving JARVIS
 */
contract JrtToJarvisConverter is
  StandardAccessControlEnumerable,
  ConverterActivator
{
  using PreciseUnitMath for uint256;

  IERC20 public immutable JRT;
  IERC20 public immutable JARVIS;
  uint256 public immutable JRT_JARVIS_RATIO;

  uint256 public totalJRTMigrated;
  uint256 public totalJarvisDistributed;

  event JrtMigrated(
    address indexed sender,
    uint256 jrtAmount,
    uint256 jarvisAmount
  );
  event Withdrawn(uint256 indexed amount, address indexed recipient);

  /**
   * @param jrt the address of the JRT token
   * @param jarvis the address of the JARVIS token
   * @param ratio the exchange rate between JRT and JARVIS
   * @param roles input roles
   */
  constructor(
    IERC20 jrt,
    IERC20 jarvis,
    uint256 ratio,
    Roles memory roles
  ) {
    // we can add checks on the addresses passed
    JRT = jrt;
    JARVIS = jarvis;
    require(ratio != 0, 'Null ratio');
    JRT_JARVIS_RATIO = ratio;

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
   * @dev withdraws an amount of JARVIS from the contract
   * @param amount amount of JARVIS to withdraw
   */
  function withdrawJARVIS(uint256 amount) external onlyMaintainer {
    JARVIS.transfer(msg.sender, amount);

    emit Withdrawn(amount, msg.sender);
  }

  /**
   * @dev executes the migration from JRT to JARVIS. Users need to give allowance to this contract to transfer JRT before executing
   * this transaction.
   * @param amount the amount of JRT to be migrated
   */
  function migrateFromJRT(uint256 amount) external onlyActive {
    totalJRTMigrated += amount;
    JRT.transferFrom(msg.sender, address(this), amount);

    uint256 jarvisAmount = amount.div(JRT_JARVIS_RATIO);
    totalJarvisDistributed += jarvisAmount;
    JARVIS.transfer(msg.sender, jarvisAmount);

    emit JrtMigrated(msg.sender, amount, jarvisAmount);
  }

  function getTotalMigration()
    external
    view
    returns (uint256 jrtMigrated, uint256 jarvisDistributed)
  {
    jrtMigrated = totalJRTMigrated;
    jarvisDistributed = totalJarvisDistributed;
  }
}
