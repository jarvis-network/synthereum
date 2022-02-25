// SPDX-License-Identifier: AGPL-3.0-only

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ILendingProxy} from '../lending-module/interfaces/ILendingProxy.sol';
import {
  IPoolStorageManager
} from '../lending-module/interfaces/IPoolStorageManager.sol';
import {ISynthereumDeployment} from '../common/interfaces/IDeployment.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';

interface ATokenMock {
  function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}

contract PoolLendingMock is ISynthereumDeployment {
  using SafeERC20 for IERC20;

  IERC20 collToken;
  IERC20 synthToken;
  ILendingProxy proxy;
  IPoolStorageManager storageManager;

  constructor(
    address collateral,
    address synth,
    address lendingProxy,
    address _storageManager
  ) {
    collToken = IERC20(collateral);
    synthToken = IERC20(synth);
    proxy = ILendingProxy(lendingProxy);
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

  function deposit(uint256 amount, address token) external {
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    IERC20(token).safeIncreaseAllowance(address(proxy), amount);
    proxy.deposit(amount);
  }

  function withdraw(
    uint256 amount,
    address recipient,
    address token
  ) external {
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    IERC20(token).safeIncreaseAllowance(address(proxy), amount);
    proxy.withdraw(amount, recipient);
  }
}
