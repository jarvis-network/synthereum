pragma solidity 0.8.9;

import {IStandardERC20} from '../base/interfaces/IStandardERC20.sol';
import {
  IDeploymentSignature
} from '../core/interfaces/IDeploymentSignature.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {
  ISynthereumMultiLpLiquidityPool
} from '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPool.sol';
import {SynthereumMultiLPVaultCreator} from './VaultCreator.sol';
import {FactoryConditions} from '../common/FactoryConditions.sol';
import {IVault} from './interfaces/IVault.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract SynthereumMultiLPVaultFactory is
  IDeploymentSignature,
  ReentrancyGuard,
  FactoryConditions,
  SynthereumMultiLPVaultCreator
{
  bytes4 public immutable override deploymentSignature;
  ISynthereumFinder immutable synthereumFinder;

  /**
   * @param _vaultImplementation Address of the deployed vault implementation used for EIP1167
   */
  constructor(address _vaultImplementation, address _synthereumFinder)
    SynthereumMultiLPVaultCreator(_vaultImplementation)
  {
    deploymentSignature = this.createVault.selector;
    synthereumFinder = ISynthereumFinder(_synthereumFinder);
  }

  /**
   * @notice Check if the sender is the deployer and deploy a vault
   * @param _lpTokenName name of the LP token representing a share in the vault
   * @param _lpTokenSymbol symbol of the LP token representing a share in the vault
   * @param _pool address of MultiLP pool the vault interacts with
   * @param _overCollateralization over collateral requirement of the vault position in the pool
   * @return vault Deployed vault
   */
  function createVault(
    string memory _lpTokenName,
    string memory _lpTokenSymbol,
    address _pool,
    uint256 _overCollateralization
  ) public override nonReentrant returns (IVault vault) {
    ISynthereumMultiLpLiquidityPool pool =
      ISynthereumMultiLpLiquidityPool(_pool);

    checkDeploymentConditions(
      synthereumFinder,
      IStandardERC20(address(pool.collateralToken())),
      pool.priceFeedIdentifier()
    );

    vault = super.createVault(
      _lpTokenName,
      _lpTokenSymbol,
      _pool,
      _overCollateralization
    );
  }
}
