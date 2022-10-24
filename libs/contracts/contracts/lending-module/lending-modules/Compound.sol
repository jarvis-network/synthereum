import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ILendingModule} from '../interfaces/ILendingModule.sol';
import {ILendingStorageManager} from '../interfaces/ILendingStorageManager.sol';
import {ICompoundToken} from '../interfaces/ICToken.sol';
import {IRewardsController} from '../interfaces/IRewardsController.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';
import {
  SynthereumPoolMigrationFrom
} from '../../synthereum-pool/common/migration/PoolMigrationFrom.sol';

contract CompoundModule is ILendingModule {
  using SafeERC20 for IERC20;

  function deposit(
    ILendingStorageManager.PoolStorage calldata _poolData,
    bytes calldata _lendingArgs,
    uint256 _amount
  )
    external
    returns (
      uint256 totalInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    )
  {
    // proxy should have received collateral from the pool
    IERC20 collateral = IERC20(_poolData.collateral);
    require(collateral.balanceOf(address(this)) >= _amount, 'Wrong balance');

    // initialise compound interest token
    ICompoundToken cToken = ICompoundToken(_poolData.interestBearingToken);

    // get tokens balance before
    uint256 cTokenBalanceBefore = cToken.balanceOf((msg.sender));

    // calculate accrued interest since last operation
    (uint256 interest, uint256 poolBalance) =
      calculateGeneratedInterest(msg.sender, _poolData, _amount, cToken, true);

    // approve and deposit underlying
    collateral.safeIncreaseAllowance(address(cToken), _amount);
    uint256 success = cToken.mintBehalf(msg.sender, _amount);
    require(success == 0, 'Failed mint');

    // get tokens balance before
    uint256 cTokenBalanceAfter = cToken.balanceOf((msg.sender));

    // set return values
    totalInterest = interest;
    tokensOut = cTokenBalanceAfter - cTokenBalanceBefore;
    tokensTransferred = tokensOut;
  }

  function withdraw(
    ILendingStorageManager.PoolStorage calldata _poolData,
    address _pool,
    bytes calldata _lendingArgs,
    uint256 _amount,
    address _recipient
  )
    external
    returns (
      uint256 totalInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    )
  {}

  function totalTransfer(
    address _oldPool,
    address _newPool,
    address _collateral,
    address _interestToken,
    bytes calldata _extraArgs
  )
    external
    returns (uint256 prevTotalCollateral, uint256 actualTotalCollateral)
  {}

  function claimRewards(
    bytes calldata _lendingArgs,
    address _collateral,
    address _bearingToken,
    address _recipient
  ) external {}

  function getAccumulatedInterest(
    address _poolAddress,
    ILendingStorageManager.PoolStorage calldata _poolData,
    bytes calldata _extraArgs
  ) external view returns (uint256 totalInterest) {}

  function getInterestBearingToken(
    address _collateral,
    bytes calldata _extraArgs
  ) external view returns (address token) {}

  function collateralToInterestToken(
    uint256 _collateralAmount,
    address _collateral,
    address _interestToken,
    bytes calldata _extraArgs
  ) external view returns (uint256 interestTokenAmount) {}

  function interestTokenToCollateral(
    uint256 _interestTokenAmount,
    address _collateral,
    address _interestToken,
    bytes calldata _extraArgs
  ) external view returns (uint256 collateralAmount) {}

  function calculateGeneratedInterest(
    address _poolAddress,
    ILendingStorageManager.PoolStorage calldata _pool,
    uint256 _amount,
    ICompoundToken _cToken,
    bool _isDeposit
  ) internal returns (uint256 totalInterestGenerated, uint256 poolBalance) {
    if (_pool.collateralDeposited == 0) return (0, 0);

    // get current pool total amount of collateral
    poolBalance = _cToken.balanceOfUnderlying(_poolAddress);

    // the total interest is delta between current balance and lastBalance
    totalInterestGenerated = _isDeposit
      ? poolBalance -
        _pool.collateralDeposited -
        _pool.unclaimedDaoCommission -
        _pool.unclaimedDaoJRT
      : poolBalance +
        _amount -
        _pool.collateralDeposited -
        _pool.unclaimedDaoCommission -
        _pool.unclaimedDaoJRT;
  }
}
