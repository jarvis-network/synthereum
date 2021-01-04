require('dotenv').config({ path: './.env.migration' });
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const umaContracts = require('../data/uma-contract-dependencies.json');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var FeePayerPoolPartyLib = artifacts.require('FeePayerPoolPartyLib');
var PerpetualLiquidatablePoolPartyLib = artifacts.require(
  'PerpetualLiquidatablePoolPartyLib',
);
var PerpetualPositionManagerPoolPartyLib = artifacts.require(
  'PerpetualPositionManagerPoolPartyLib',
);
var PerpetualPoolPartyLib = artifacts.require('PerpetualPoolPartyLib');

var MintableBurnableTokenFactory = artifacts.require(
  'MintableBurnableTokenFactory',
);
var SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
var SynthereumDerivativeFactory = artifacts.require(
  'SynthereumDerivativeFactory',
);
var SynthereumSyntheticTokenFactory = artifacts.require(
  'SynthereumSyntheticTokenFactory',
);
var UmaFinder = artifacts.require('Finder');
var AddressWhitelist = artifacts.require('AddressWhitelist');
var IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
var TestnetERC20 = artifacts.require('TestnetERC20');
var Timer = artifacts.require('Timer');
var Registry = artifacts.require('Registry');
var derivativeVersions = require('../data/derivative-versions.json');
const {
  RegistryRolesEnum,
  getKeysForNetwork,
  interfaceName,
  deploy,
} = require('@jarvis-network/uma-common');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();
  const newUmaDeployment = process.env.NEW_UMA_INFRASTRUCTURE ?? false;
  const umaDeployment =
    (networkId != 1 && networkId != 3 && networkId != 4 && networkId != 42) ||
    newUmaDeployment;
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  if (derivativeVersions[networkId]?.DerivativeFactory?.isEnabled ?? true) {
    const synthereumFinderInstance = await SynthereumFinder.deployed();
    const keys = getKeysForNetwork(network, accounts);
    await deploy(
      deployer,
      network,
      SynthereumSyntheticTokenFactory,
      synthereumFinderInstance.address,
      derivativeVersions[networkId]?.DerivativeFactory?.version ?? 1,
      { from: keys.deployer },
    );

    if (umaDeployment == true) {
      // Deploy CollateralWhitelist.
      await deploy(deployer, network, AddressWhitelist, {
        from: keys.deployer,
      });
      const collateralWhitelistInstance = await AddressWhitelist.deployed();

      // Add CollateralWhitelist to finder.
      const UmaFinderInstance = await UmaFinder.deployed();
      await UmaFinderInstance.changeImplementationAddress(
        web3.utils.utf8ToHex(interfaceName.CollateralWhitelist),
        collateralWhitelistInstance.address,
        {
          from: keys.deployer,
        },
      );

      // Add the testnet ERC20 as the default collateral currency (USDC for our use case)
      await deploy(deployer, network, TestnetERC20, 'USD Coin', 'USDC', 6, {
        from: keys.deployer,
      });
      const collateralTokenInstance = await TestnetERC20.deployed();
      await collateralWhitelistInstance.addToWhitelist(
        collateralTokenInstance.address,
        { from: keys.deployer },
      );

      // Add the identifier for a currency pair (EUR/USD for our use case)
      const identifierWhitelistInstance = await IdentifierWhitelist.deployed();
      const identifierBytes = web3.utils.utf8ToHex('EUR/USD');
      await identifierWhitelistInstance.addSupportedIdentifier(
        identifierBytes,
        { from: keys.deployer },
      );
    }

    const synthereumSyntheticTokenFactoryInstance = await SynthereumSyntheticTokenFactory.deployed();
    //hardat
    if (FeePayerPoolPartyLib.setAsDeployed) {
      const { contract: feePayerPoolPartyInstance } = await deploy(
        deployer,
        network,
        FeePayerPoolPartyLib,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await PerpetualPositionManagerPoolPartyLib.link(
          feePayerPoolPartyInstance,
        );
        await PerpetualLiquidatablePoolPartyLib.link(feePayerPoolPartyInstance);
        await PerpetualPoolPartyLib.link(feePayerPoolPartyInstance);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, FeePayerPoolPartyLib, {
        from: keys.deployer,
      });
      await deployer.link(FeePayerPoolPartyLib, [
        PerpetualPositionManagerPoolPartyLib,
        PerpetualLiquidatablePoolPartyLib,
        PerpetualPoolPartyLib,
      ]);
    }
    //hardhat
    if (PerpetualPositionManagerPoolPartyLib.setAsDeployed) {
      const {
        contract: perpetualPositionManagerPoolPartyLibInstance,
      } = await deploy(
        deployer,
        network,
        PerpetualPositionManagerPoolPartyLib,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await PerpetualLiquidatablePoolPartyLib.link(
          perpetualPositionManagerPoolPartyLibInstance,
        );
        await PerpetualPoolPartyLib.link(
          perpetualPositionManagerPoolPartyLibInstance,
        );
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      //
      await deploy(deployer, network, PerpetualPositionManagerPoolPartyLib, {
        from: keys.deployer,
      });
      await deployer.link(PerpetualPositionManagerPoolPartyLib, [
        PerpetualLiquidatablePoolPartyLib,
        PerpetualPoolPartyLib,
      ]);
    }
    //hardhat
    if (PerpetualLiquidatablePoolPartyLib.setAsDeployed) {
      const {
        contract: perpetualLiquidatablePoolPartyLibInstance,
      } = await deploy(deployer, network, PerpetualLiquidatablePoolPartyLib, {
        from: keys.deployer,
      });

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await PerpetualPoolPartyLib.link(
          perpetualLiquidatablePoolPartyLibInstance,
        );
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, PerpetualLiquidatablePoolPartyLib, {
        from: keys.deployer,
      });
      await deployer.link(
        PerpetualLiquidatablePoolPartyLib,
        PerpetualPoolPartyLib,
      );
    }
    //hardhat
    if (PerpetualPoolPartyLib.setAsDeployed) {
      const { contract: perpetualPoolPartyLibInstance } = await deploy(
        deployer,
        network,
        PerpetualPoolPartyLib,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SynthereumDerivativeFactory.link(perpetualPoolPartyLibInstance);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, PerpetualPoolPartyLib);
      await deployer.link(PerpetualPoolPartyLib, SynthereumDerivativeFactory);
    }

    // Deploy derivative factory
    await deploy(
      deployer,
      network,
      SynthereumDerivativeFactory,
      synthereumFinderInstance.address,
      umaDeployment
        ? (await UmaFinder.deployed()).address
        : umaContracts[networkId].finderAddress,
      synthereumSyntheticTokenFactoryInstance.address,
      umaDeployment ? (await Timer.deployed()).address : ZERO_ADDRESS,
      { from: keys.deployer },
    );

    const derivativeFactoryInstance = await SynthereumDerivativeFactory.deployed();
    const synthereumFactoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
    await synthereumFactoryVersioningInstance.setDerivativeFactory(
      derivativeVersions[networkId]?.DerivativeFactory?.version ?? 1,
      derivativeFactoryInstance.address,
      { from: maintainer },
    );
    if (umaDeployment == true) {
      const registryInstance = await Registry.deployed();
      await registryInstance.addMember(
        RegistryRolesEnum.CONTRACT_CREATOR,
        derivativeFactoryInstance.address,
        { from: keys.deployer },
      );
    }
  }
};
