// SPDX-License-Identifier: AGPL-3.0-only

import {ISynthereumDeployment} from '../common/interfaces/IDeployment.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ILendingModule} from '../lending-module/interfaces/ILendingModule.sol';
import {
  IPoolStorageManager
} from '../lending-module/interfaces/IPoolStorageManager.sol';

interface ATokenMock {
  function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}

contract PoolLendingMock is ISynthereumDeployment {
  IERC20 collToken;
  IERC20 synthToken;
  ILendingModule module;
  IPoolStorageManager storageManager;

  constructor(
    address collateral,
    address synth,
    address lending,
    address _storageManager
  ) {
    collToken = IERC20(collateral);
    synthToken = IERC20(synth);
    module = ILendingModule(lending);
    storageManager = IPoolStorageManager(_storageManager);
  }

  function synthereumFinder() external pure returns (ISynthereumFinder finder) {
    return finder;
  }

  function version() external pure returns (uint8 contractVersion) {
    return 0;
  }

  function collateralToken() external view returns (IERC20) {
    return collToken;
  }

  function syntheticToken() external view returns (IERC20 syntheticCurrency) {
    return synthToken;
  }

  function syntheticTokenSymbol() external pure returns (string memory symbol) {
    return 'test';
  }

  function deposit(
    IPoolStorageManager.PoolStorage calldata poolData,
    uint256 amount
  ) external {
    module.deposit(poolData, storageManager, amount);
  }

  function withdraw(
    IPoolStorageManager.PoolStorage calldata poolData,
    uint256 amount,
    address recipient
  ) external {
    module.withdraw(poolData, storageManager, amount, recipient);
  }
}
