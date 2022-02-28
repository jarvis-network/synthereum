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
import 'hardhat/console.sol';

interface ATokenMock is IERC20 {
  function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}

interface AAVEMock {
  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referralCode,
    address onBehalfOf
  ) external;

  function supply(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external;

  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external returns (uint256);

  function repay(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    address onBehalfOf
  ) external returns (uint256);
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

  function deposit(uint256 amount, address token)
    external
    returns (ILendingProxy.ReturnValues memory)
  {
    IERC20(token).safeTransferFrom(msg.sender, address(proxy), amount);
    return proxy.deposit(amount);
  }

  function withdraw(
    uint256 amount,
    address recipient,
    address token
  ) external returns (ILendingProxy.ReturnValues memory) {
    IERC20(token).safeTransferFrom(msg.sender, address(proxy), amount);
    return proxy.withdraw(amount, recipient);
  }
}
