// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IVault {
  event Deposit(
    uint256 netCollateralDeposited,
    uint256 lpTokensOut,
    uint256 rate,
    uint256 discountedRate
  );

  event Withdraw(
    uint256 lpTokensBurned,
    uint256 netCollateralOut,
    uint256 rate
  );

  event LPActivated(uint256 collateralAmount, uint256 overCollateralization);

  /**
   * @notice Initialize vault as per OZ Clones pattern
   * @param _lpTokenName name of the LP token representing a share in the vault
   * @param _lpTokenSymbol symbol of the LP token representing a share in the vault
   * @param _pool address of MultiLP pool the vault interacts with
   * @param _overCollateralization over collateral requirement of the vault position in the pool   */
  function initialize(
    string memory _lpTokenName,
    string memory _lpTokenSymbol,
    address _pool,
    uint256 _overCollateralization
  ) external;

  function deposit(uint256 collateralAmount)
    external
    returns (uint256 lpTokensOut);

  function withdraw(uint256 lpTokensAmount)
    external
    returns (uint256 collateralOut);

  function getRate() external view returns (uint256 rate);

  function getPool() external view returns (address poolAddress);

  function getPoolCollateral() external view returns (address collateral);

  function getOvercollateralisation()
    external
    view
    returns (uint256 overcollateral);
}
