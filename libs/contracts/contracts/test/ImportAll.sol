// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity >=0.8.0;

import '../base/interfaces/IStandardERC20.sol';
import '../base/utils/StringUtils.sol';
import '../base/utils/PreciseUnitMath.sol';
import '../common/interfaces/IEmergencyShutdown.sol';
import '../common/interfaces/IDeployment.sol';
import '../common/FactoryConditions.sol';
import '../common/ERC2771Context.sol';
import '../test/MockAggregator.sol';
import '../test/MockRandomAggregator.sol';
import '../test/TestnetERC20.sol';
import '../test/TestnetSelfMintingERC20.sol';
import '../test/SelfMintingControllerMock.sol';
import '../test/CreditLineControllerMock.sol';
import '../test/MockOnChainOracle.sol';
import '../test/PriceFeedGetter.sol';
import '../test/UtilsMock.sol';
import '../test/DerivativeMock.sol';
import '../test/PoolMock.sol';
import '../test/PoolLendingMock.sol';
import '../test/WrongTypology.sol';
import '../test/PoolRegistryMock.sol';
import '../test/MockContext.sol';
import '../test/MockCreditLineContext.sol';
import '../oracle/common/interfaces/IPriceFeed.sol';
import '../oracle/chainlink/interfaces/IChainlinkPriceFeed.sol';
import '../oracle/chainlink/ChainlinkPriceFeed.sol';
import '../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import '../synthereum-pool/v5/interfaces/ILiquidityPoolGeneral.sol';
import '../synthereum-pool/v5/interfaces/ILiquidityPoolInteraction.sol';
import '../synthereum-pool/v5/interfaces/ILiquidityPool.sol';
import '../synthereum-pool/v5/interfaces/ILiquidityPoolStorage.sol';
import '../synthereum-pool/v5/LiquidityPool.sol';
import '../synthereum-pool/v5/LiquidityPoolLib.sol';
import '../synthereum-pool/v5/LiquidityPoolCreator.sol';
import '../synthereum-pool/v5/LiquidityPoolFactory.sol';
import '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPoolEvents.sol';
import '../synthereum-pool/v6/interfaces/IMultiLpLiquidityPool.sol';
import '../synthereum-pool/v6/MultiLpLiquidityPool.sol';
import '../core/Manager.sol';
import '../core/FactoryVersioning.sol';
import '../core/Finder.sol';
import '../core/interfaces/IFinder.sol';
import '../core/interfaces/IManager.sol';
import '../core/interfaces/IFactoryVersioning.sol';
import '../core/interfaces/IDeploymentSignature.sol';
import '../core/interfaces/IDeployer.sol';
import '../core/interfaces/IJarvisBrrrrr.sol';
import '../core/Constants.sol';
import '../core/Deployer.sol';
import '../core/JarvisBrrrrr.sol';
import '../core/CollateralWhitelist.sol';
import '../core/IdentifierWhitelist.sol';
import '../core/TrustedForwarder.sol';
import '../core/interfaces/ICollateralWhitelist.sol';
import '../core/interfaces/IIdentifierWhitelist.sol';
import '../core/registries/SelfMintingRegistry.sol';
import '../core/registries/interfaces/IRegistry.sol';
import '../core/registries/Registry.sol';
import '../core/registries/PoolRegistry.sol';
import '../self-minting/v1/interfaces/ISelfMintingMultiParty.sol';
import '../self-minting/v2/CreditLineCreator.sol';
import '../self-minting/v2/CreditLineFactory.sol';
import '../self-minting/v2/CreditLineController.sol';
import '../self-minting/v2/interfaces/ICreditLine.sol';
import '../self-minting/v2/interfaces/ICreditLineController.sol';
import '../tokens/MintableBurnableSyntheticToken.sol';
import '../tokens/MintableBurnableSyntheticTokenPermit.sol';
import '../tokens/interfaces/BaseControlledMintableBurnableERC20.sol';
import '../tokens/interfaces/IMintableBurnableERC20.sol';
import '../tokens/factories/interfaces/IMintableBurnableTokenFactory.sol';
import '../tokens/MintableBurnableERC20.sol';
import '../tokens/factories/MintableBurnableTokenFactory.sol';
import '../tokens/factories/SyntheticTokenFactory.sol';
import '../tokens/factories/SyntheticTokenPermitFactory.sol';
import '../core/registries/FixedRateRegistry.sol';
import '../fixed-rate/v1/FixedRateCreator.sol';
import '../fixed-rate/v1/FixedRateFactory.sol';
import '../fixed-rate/v1/FixedRateWrapper.sol';
import '../fixed-rate/v1/interfaces/IFixedRateWrapper.sol';
import '../lending-module/LendingProxy.sol';
import '../lending-module/LendingStorageManager.sol';
import '../lending-module/lending-modules/AaveV3.sol';
import '../lending-module/swap-modules/Univ2JRTSwap.sol';
