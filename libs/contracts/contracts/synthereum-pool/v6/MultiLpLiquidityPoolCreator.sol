// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {
  IMintableBurnableTokenFactory
} from '../../tokens/factories/interfaces/IMintableBurnableTokenFactory.sol';
import {ISynthereumFinder} from '../../core/interfaces/IFinder.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from './interfaces/IMultiLpLiquidityPool.sol';
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';
import {
  ILendingStorageManager
} from '../../lending-module/interfaces/ILendingStorageManager.sol';
import {
  BaseControlledMintableBurnableERC20
} from '../../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import {SynthereumInterfaces} from '../../core/Constants.sol';
import {Clones} from '@openzeppelin/contracts/proxy/Clones.sol';
import {SynthereumMultiLpLiquidityPool} from './MultiLpLiquidityPool.sol';

contract SynthereumMultiLpLiquidityPoolCreator {
  using Clones for address;

  struct Params {
    uint8 version;
    IStandardERC20 collateralToken;
    string syntheticName;
    string syntheticSymbol;
    address syntheticToken;
    ISynthereumMultiLpLiquidityPool.Roles roles;
    uint256 fee;
    bytes32 priceIdentifier;
    uint256 overCollateralRequirement;
    uint256 liquidationReward;
    LendingManagerParams lendingManagerParams;
  }

  struct LendingManagerParams {
    string lendingId;
    address interestBearingToken;
    uint64 daoInterestShare;
    uint64 jrtBuybackShare;
  }

  // Address of Synthereum Finder
  ISynthereumFinder public immutable synthereumFinder;

  address public immutable poolImplementation;

  //----------------------------------------
  // Events
  //----------------------------------------
  event CreatedPool(
    address indexed poolAddress,
    uint8 indexed version,
    address indexed deployerAddress
  );

  //----------------------------------------
  // Constructor
  //----------------------------------------

  /**
   * @notice Constructs the Pool contract.
   * @param _synthereumFinder Synthereum Finder address used to discover other contracts
   * @param _poolImplementation Address of the deployed pool implementation used for EIP1167
   */
  constructor(address _synthereumFinder, address _poolImplementation) {
    synthereumFinder = ISynthereumFinder(_synthereumFinder);
    poolImplementation = _poolImplementation;
  }

  //----------------------------------------
  // Public functions
  //----------------------------------------

  /**
   * @notice Creates an instance of the pool
   * @param _params is a `ConstructorParams` object from LiquidityPool.
   * @return pool address of the deployed pool contract.
   */
  function createPool(Params calldata _params)
    public
    virtual
    returns (ISynthereumMultiLpLiquidityPool pool)
  {
    pool = ISynthereumMultiLpLiquidityPool(poolImplementation.clone());
    require(bytes(_params.syntheticName).length != 0, 'Missing synthetic name');
    require(
      bytes(_params.syntheticSymbol).length != 0,
      'Missing synthetic symbol'
    );
    BaseControlledMintableBurnableERC20 tokenCurrency;
    if (_params.syntheticToken == address(0)) {
      IMintableBurnableTokenFactory tokenFactory =
        IMintableBurnableTokenFactory(
          ISynthereumFinder(synthereumFinder).getImplementationAddress(
            SynthereumInterfaces.TokenFactory
          )
        );
      tokenCurrency = tokenFactory.createToken(
        _params.syntheticName,
        _params.syntheticSymbol,
        18
      );
      // Give permissions to new pool contract and then hand over ownership.
      tokenCurrency.addMinter(address(pool));
      tokenCurrency.addBurner(address(pool));
      tokenCurrency.addAdmin(
        synthereumFinder.getImplementationAddress(SynthereumInterfaces.Manager)
      );
      tokenCurrency.renounceAdmin();
    } else {
      tokenCurrency = BaseControlledMintableBurnableERC20(
        _params.syntheticToken
      );
      require(
        keccak256(abi.encodePacked(tokenCurrency.name())) ==
          keccak256(abi.encodePacked(_params.syntheticName)),
        'Wrong synthetic token name'
      );
      require(
        keccak256(abi.encodePacked(tokenCurrency.symbol())) ==
          keccak256(abi.encodePacked(_params.syntheticSymbol)),
        'Wrong synthetic token symbol'
      );
    }
    pool.initialize(_convertParams(_params, tokenCurrency));
    _setPoolParams(
      address(pool),
      address(_params.collateralToken),
      _params.lendingManagerParams
    );
    emit CreatedPool(address(pool), _params.version, msg.sender);
  }

  // Converts createPool params to constructor params.
  function _convertParams(
    Params memory _params,
    BaseControlledMintableBurnableERC20 _tokenCurrency
  )
    internal
    view
    returns (
      SynthereumMultiLpLiquidityPool.InitializationParams
        memory initializationParams
    )
  {
    require(_params.roles.admin != address(0), 'Admin cannot be 0x00');
    initializationParams.finder = synthereumFinder;
    initializationParams.version = _params.version;
    initializationParams.collateralToken = _params.collateralToken;
    initializationParams.syntheticToken = IMintableBurnableERC20(
      address(_tokenCurrency)
    );
    initializationParams.roles = _params.roles;
    initializationParams.fee = _params.fee;
    initializationParams.priceIdentifier = _params.priceIdentifier;
    initializationParams.overCollateralRequirement = _params
      .overCollateralRequirement;
    initializationParams.liquidationReward = _params.liquidationReward;
    initializationParams.lendingModuleId = _params
      .lendingManagerParams
      .lendingId;
  }

  // Set lending module params of the pool in the LendingStorageManager
  function _setPoolParams(
    address _pool,
    address _collateral,
    LendingManagerParams calldata _lendingManagerParams
  ) internal {
    ILendingStorageManager lendingStorageManager =
      ILendingStorageManager(
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.LendingStorageManager
        )
      );
    lendingStorageManager.setPoolStorage(
      _lendingManagerParams.lendingId,
      _pool,
      _collateral,
      _lendingManagerParams.interestBearingToken,
      _lendingManagerParams.daoInterestShare,
      _lendingManagerParams.jrtBuybackShare
    );
  }
}
