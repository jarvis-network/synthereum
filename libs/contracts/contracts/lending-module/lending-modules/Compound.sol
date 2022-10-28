import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ILendingModule} from '../interfaces/ILendingModule.sol';
import {ILendingStorageManager} from '../interfaces/ILendingStorageManager.sol';
import {ICompoundToken, IComptroller} from '../interfaces/ICToken.sol';
import {ExponentialNoError} from '../libs/ExponentialNoError.sol';
import {IRewardsController} from '../interfaces/IRewardsController.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {PreciseUnitMath} from '../../base/utils/PreciseUnitMath.sol';
import {
  SynthereumPoolMigrationFrom
} from '../../synthereum-pool/common/migration/PoolMigrationFrom.sol';

contract CompoundModule is ILendingModule, ExponentialNoError {
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
    (totalInterest, ) = calculateGeneratedInterest(
      msg.sender,
      _poolData,
      _amount,
      cToken,
      true
    );

    // approve and deposit underlying
    collateral.safeIncreaseAllowance(address(cToken), _amount);
    uint256 success = cToken.mintBehalf(msg.sender, _amount);
    require(success == 0, 'Failed mint');

    // get tokens balance before
    uint256 cTokenBalanceAfter = cToken.balanceOf((msg.sender));

    // set return values
    tokensOut = cTokenBalanceAfter - cTokenBalanceBefore;
    tokensTransferred = tokensOut;
  }

  function withdraw(
    ILendingStorageManager.PoolStorage calldata _poolData,
    address _pool,
    bytes calldata _lendingArgs,
    uint256 _cTokenAmount,
    address _recipient
  )
    external
    returns (
      uint256 totalInterest,
      uint256 tokensOut,
      uint256 tokensTransferred
    )
  {
    // initialise compound interest token
    ICompoundToken cToken = ICompoundToken(_poolData.interestBearingToken);

    // get balance of collateral before redeeming
    IERC20 collateralToken = IERC20(_poolData.collateral);
    uint256 balanceBefore = collateralToken.balanceOf(address(this));

    // calculate accrued interest since last operation
    (totalInterest, ) = calculateGeneratedInterest(
      _pool,
      _poolData,
      _cTokenAmount,
      cToken,
      false
    );

    uint256 success = cToken.redeem(_cTokenAmount);
    require(success == 0, 'Failed withdraw');

    // get balance of collateral after redeeming
    uint256 balanceAfter = collateralToken.balanceOf(address(this));

    // set return values
    tokensTransferred = tokensOut;
    tokensOut = balanceAfter - balanceBefore;

    // transfer underlying
    IERC20(address(cToken)).safeTransfer(_pool, tokensOut);
  }

  function totalTransfer(
    address _oldPool,
    address _newPool,
    address _collateral,
    address _interestToken,
    bytes calldata _extraArgs
  )
    external
    returns (uint256 prevTotalCollateral, uint256 actualTotalCollateral)
  {
    prevTotalCollateral = SynthereumPoolMigrationFrom(_oldPool)
      .migrateTotalFunds(_newPool);
    actualTotalCollateral = IERC20(_interestToken).balanceOf(_newPool);
  }

  // TODO
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
  ) external view returns (uint256 totalInterest) {
    ICompoundToken cToken = ICompoundToken(_poolData.interestBearingToken);

    (, uint256 tokenBalance, , uint256 excMantissa) =
      cToken.getAccountSnapshot(_poolAddress);
    Exp memory exchangeRate = Exp({mantissa: excMantissa});

    uint256 totCollateral = mul_ScalarTruncate(exchangeRate, tokenBalance);
    totalInterest =
      totCollateral -
      _poolData.collateralDeposited -
      _poolData.unclaimedDaoCommission -
      _poolData.unclaimedDaoJRT;
  }

  function getInterestBearingToken(
    address _collateral,
    bytes calldata _extraArgs
  ) external view returns (address token) {
    IComptroller comptroller = IComptroller(abi.decode(_extraArgs, (address)));
    address[] memory markets = comptroller.getAllMarkets();

    for (uint256 i = 0; i < markets.length; i++) {
      try ICompoundToken(markets[i]).underlying() returns (address coll) {
        if (coll == _collateral) {
          token = markets[i];
          break;
        }
      } catch {}
    }
    require(token != address(0), 'Token not found');
  }

  function collateralToInterestToken(
    uint256 _collateralAmount,
    address _collateral,
    address _interestToken,
    bytes calldata _extraArgs
  ) external view returns (uint256 interestTokenAmount) {
    (, , , uint256 excMantissa) =
      ICompoundToken(_interestToken).getAccountSnapshot(address(this));
    Exp memory exchangeRate = Exp({mantissa: excMantissa});

    return div_(_collateralAmount, exchangeRate);
  }

  function interestTokenToCollateral(
    uint256 _interestTokenAmount,
    address _collateral,
    address _interestToken,
    bytes calldata _extraArgs
  ) external view returns (uint256 collateralAmount) {
    (, , , uint256 excMantissa) =
      ICompoundToken(_interestToken).getAccountSnapshot(address(this));
    Exp memory exchangeRate = Exp({mantissa: excMantissa});

    return mul_ScalarTruncate(exchangeRate, _interestTokenAmount);
  }

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
