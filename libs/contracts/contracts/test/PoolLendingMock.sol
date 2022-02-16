import {
  ISynthereumDeployment
} from '@jarvis-network/synthereum-contracts/contracts/common/interfaces/IDeployment.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  ILendingModule
} from '@jarvis-network/synthereum-contracts/contracts/lending-module/interfaces/ILendingModule.sol';

contract PoolLendingMock is ISynthereumDeployment {
  IERC20 collToken;
  IERC20 synthToken;
  ILendingModule module;

  constructor(
    IERC20 collateral,
    IERC20 synth,
    ILendingModule lending
  ) {
    collToken = collateral;
    synthToken = synth;
    module = lending;
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

  function deposit(ILendingProxy.PoolStorage calldata poolData, uint256 amount)
    external
  {
    module.deposit(poolData, amount);
  }

  function withdraw(
    ILendingProxy.PoolStorage calldata poolData,
    uint256 amount,
    address recipient
  ) external {
    module.withdraw(poolData, amount, recipient);
  }
}
