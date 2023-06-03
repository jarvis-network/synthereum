// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {
  StandardAccessControlEnumerable
} from '../../common/roles/StandardAccessControlEnumerable.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';

contract JrtToJarvisMigrator is StandardAccessControlEnumerable {
  using PreciseUnitMath for uint256;

  IERC20 public immutable JRT;
  IMintableBurnableERC20 public immutable JARVIS;
  uint256 public immutable JRT_JARVIS_RATIO;

  uint256 public totalJRTMigrated;
  uint256 public activationBlock;

  event MigrationStartBlock(uint256 indexed blockNumber);
  event JrtMigrated(
    address indexed sender,
    uint256 indexed jrtAmount,
    uint256 indexed jarvisAmount
  );
  event Withdrawn(uint256 indexed amount, address indexed recipient);

  /**
   * @param jrt the address of the JRT token
   * @param jarvis the address of the JARVIS token
   * @param ratio the exchange rate between JRT and JARVIS
   */
  constructor(
    IERC20 jrt,
    IMintableBurnableERC20 jarvis,
    uint256 ratio,
    Roles memory _roles
  ) {
    // we can add checks on the addresses passed
    JRT = jrt;
    JARVIS = jarvis;
    JRT_JARVIS_RATIO = ratio;

    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  /**
   * @dev sets the block number at which the migration will be opened
   * @dev set to 0 to interrupt migration
   * @param blockNumber starting block number
   */
  function setActivationBlock(uint256 blockNumber) external onlyMaintainer {
    require(blockNumber >= block.number, 'Err');
    activationBlock = blockNumber;
    emit MigrationStartBlock(blockNumber);
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
   * @dev this contract needs to have minter role
   * @param amount the amount of JRT to be migrated
   */
  function migrateFromJRT(uint256 amount) external {
    require(
      activationBlock != 0 && block.number >= activationBlock,
      'Not active'
    );

    totalJRTMigrated += amount;
    JRT.transferFrom(msg.sender, address(this), amount);

    uint256 jarvisAmount = amount.div(JRT_JARVIS_RATIO);
    JARVIS.transfer(msg.sender, jarvisAmount);

    emit JrtMigrated(msg.sender, amount, jarvisAmount);
  }

  function getTotalMigration()
    external
    view
    returns (uint256 jrtMigrated, uint256 jarvisDistributed)
  {
    jrtMigrated = totalJRTMigrated;
    jarvisDistributed = jrtMigrated.div(JRT_JARVIS_RATIO);
  }
}
