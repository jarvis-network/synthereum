// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

contract ConverterActivator {
  uint256 public activationBlock;

  event MigrationStartBlock(uint256 indexed blockNumber);

  modifier onlyActive() {
    require(
      activationBlock != 0 && block.number >= activationBlock,
      'Not active'
    );
    _;
  }

  /**
   * @dev sets the block number at which the migration will be opened
   * @dev set to 0 to interrupt migration
   * @param blockNumber starting block number
   */
  function _setActivationBlock(uint256 blockNumber) internal {
    require(activationBlock == 0, 'Already active');
    require(blockNumber >= block.number, 'Wrong block number');
    activationBlock = blockNumber;
    emit MigrationStartBlock(blockNumber);
  }
}
