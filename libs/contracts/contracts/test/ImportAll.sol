// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.4;

import './UmaInfra.sol';
import '../base/interfaces/IStandardERC20.sol';
import '../base/interfaces/IRole.sol';
import '../base/utils/EnumerableBytesSet.sol';
import '../base/utils/StringUtils.sol';
import '../test/SelfMintingDerivativeFactoryMock.sol';
import '../test/MockAggregator.sol';
import '../test/MockRandomAggregator.sol';
import '../test/TestnetSelfMintingERC20.sol';
import '../test/SelfMintingControllerMock.sol';
import '../test/PriceFeedGetter.sol';
import '../test/UtilsMock.sol';
import '../test/DerivativeMock.sol';
import '../test/PoolFactoryMock.sol';
import '../test/PoolMock.sol';
import '../oracle/common/interfaces/IPriceFeed.sol';
import '../oracle/chainlink/interfaces/IChainlinkPriceFeed.sol';
import '../oracle/chainlink/ChainlinkPriceFeed.sol';
import '../synthereum-pool/v4/interfaces/IPoolGeneral.sol';
import '../synthereum-pool/common/interfaces/IPoolDeployment.sol';
import '../synthereum-pool/common/interfaces/IPoolWithDerivativeDeployment.sol';
import '../synthereum-pool/v4/interfaces/IPoolInteraction.sol';
import '../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';
import '../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeedStorage.sol';
import '../synthereum-pool/v4/PoolOnChainPriceFeed.sol';
import '../synthereum-pool/v4/PoolOnChainPriceFeedFactory.sol';
import '../synthereum-pool/v4/PoolOnChainPriceFeedCreator.sol';
import '../synthereum-pool/v4/PoolOnChainPriceFeedLib.sol';
import '../core/Manager.sol';
import '../core/FactoryVersioning.sol';
import '../core/Finder.sol';
import '../core/interfaces/IFinder.sol';
import '../core/interfaces/IManager.sol';
import '../core/interfaces/IFactoryVersioning.sol';
import '../core/interfaces/IDeploymentSignature.sol';
import '../core/interfaces/IDeployer.sol';
import '../core/Constants.sol';
import '../core/Deployer.sol';
import '../core/registries/SelfMintingRegistry.sol';
import '../core/registries/interfaces/IRegistry.sol';
import '../core/registries/Registry.sol';
import '../core/registries/PoolRegistry.sol';
import '../derivative/self-minting/common/interfaces/ISelfMintingDerivativeDeployment.sol';
import '../derivative/self-minting/common/interfaces/ISelfMintingController.sol';
import '../derivative/self-minting/common/SelfMintingController.sol';
import '../derivative/self-minting/v1/SelfMintingDerivativeFactory.sol';
import '../derivative/self-minting/v1/SelfMintingPerpetualPositionManagerMultiPartyLib.sol';
import '../derivative/self-minting/v1/SelfMintingPerpetualLiquidatableMultiParty.sol';
import '../derivative/self-minting/v1/SelfMintingPerpetualMultiParty.sol';
import '../derivative/self-minting/v1/SelfMintingPerpetualPositionManagerMultiParty.sol';
import '../derivative/self-minting/v1/SelfMintingPerpetualLiquidatableMultiPartyLib.sol';
import '../derivative/self-minting/v1/SelfMintingPerpetualMultiPartyLib.sol';
import '../derivative/self-minting/v1/SelfMintingPerpetutalMultiPartyCreator.sol';
import '../tokens/MintableBurnableSyntheticToken.sol';
import '../tokens/MintableBurnableSyntheticTokenPermit.sol';
import '../derivative/common/interfaces/IDerivativeDeployment.sol';
import '../tokens/interfaces/MintableBurnableIERC20.sol';
import '../derivative/common/interfaces/IDerivative.sol';
import '../derivative/common/interfaces/IDerivativeMain.sol';
import '../tokens/factories/interfaces/IMintableBurnableTokenFactory.sol';
import '../tokens/MintableBurnableERC20.sol';
import '../tokens/factories/MintableBurnableTokenFactory.sol';
import '../tokens/factories/SyntheticTokenFactory.sol';
import '../tokens/factories/SyntheticTokenPermitFactory.sol';
import '../derivative/common/FeePayerPartyLib.sol';
import '../derivative/common/FeePayerParty.sol';
import '../derivative/v2/PerpetualPoolPartyLib.sol';
import '../derivative/v2/DerivativeFactory.sol';
import '../derivative/v2/PerpetualPoolParty.sol';
import '../derivative/v2/PerpetualPositionManagerPoolParty.sol';
import '../derivative/v2/PerpetualPositionManagerPoolPartyLib.sol';
import '../derivative/v2/PerpetualLiquidatablePoolPartyLib.sol';
import '../derivative/v2/PerpetutalPoolPartyCreator.sol';
import '../derivative/v2/PerpetualLiquidatablePoolParty.sol';