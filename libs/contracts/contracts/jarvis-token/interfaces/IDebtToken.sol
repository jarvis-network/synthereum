// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IDebtToken {
  event Donated(address indexed user, uint256 amount);
  event Bonded(address indexed user, uint256 amount);
  event Withdrawn(uint256 amount, address indexed recipient);

  /**
   * @notice Deposit j-asset in the debt token contract
   * @param _amount Amount of j-asset to deposit
   * @param _isDonation If true no debt-tokens are minted, if false 1:1
   */
  function depositJFiat(uint256 _amount, bool _isDonation) external;

  /**
   * @notice Allow maintainer to withdraw jFiat into a recipient
   * @notice Only maintainer can call this function
   * @param _amount Amount of j-asset to withdraw
   * @param _recipient Address will receive j-asset
   */
  function withdrawJFiat(uint256 _amount, address _recipient) external;

  /**
   * @notice Returns address of the synthetic token associated to the debt token
   * @return Address of the synthetic token
   */
  function jAsset() external view returns (address);

  /**
   * @notice Returns balance of the synthetic token holded by the debt-token
   * @return Balance of the synthetic token holded
   */
  function jFiatBalance() external view returns (uint256);

  /**
   * @notice Returns balance of the synthetic token donated by users
   * @return Balance of the synthetic token donated
   */
  function donated() external view returns (uint256);

  /**
   * @notice Returns balance of the synthetic token bonded by users
   * @return Balance of the synthetic token bonded
   */
  function bonded() external view returns (uint256);

  /**
   * @notice Returns balance of the synthetic token withdrawn by the maintainer
   * @return Balance of the synthetic token withdrawn
   */
  function withdrawn() external view returns (uint256);
}
