require('dotenv').config({ path: './.env.migration' });
const {
  parseBoolean,
} = require('@jarvis-network/core-utils/dist/base/asserts');
const rolesConfig = require('../data/roles.json');
const { getExistingInstance } = require('../dist/migration-utils/deployment');
const umaContracts = require('../data/uma-contract-dependencies.json');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const FeePayerPartyLib = artifacts.require('FeePayerPartyLib');
const PerpetualLiquidatablePoolPartyLib = artifacts.require(
  'PerpetualLiquidatablePoolPartyLib',
);
const PerpetualPositionManagerPoolPartyLib = artifacts.require(
  'PerpetualPositionManagerPoolPartyLib',
);
const PerpetualPoolPartyLib = artifacts.require('PerpetualPoolPartyLib');

const MintableBurnableTokenFactory = artifacts.require(
  'MintableBurnableTokenFactory',
);
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const SynthereumDerivativeFactory = artifacts.require(
  'SynthereumDerivativeFactory',
);
const SynthereumSyntheticTokenFactory = artifacts.require(
  'SynthereumSyntheticTokenFactory',
);
const UmaFinder = artifacts.require('Finder');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const TestnetERC20 = artifacts.require('TestnetERC20');
const Timer = artifacts.require('Timer');
const Registry = artifacts.require('Registry');
const derivativeVersions = require('../data/derivative-versions.json');
const {
  RegistryRolesEnum,
  getKeysForNetwork,
  interfaceName,
  deploy,
} = require('@jarvis-network/uma-common');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = await toNetworkId(network);
  const synthereumFactoryVersioning = await getExistingInstance(
    web3,
    SynthereumFactoryVersioning,
  );
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const newUmaDeployment =
    parseBoolean(process.env.NEW_UMA_INFRASTRUCTURE) ?? false;
  const umaDeployment =
    (networkId != 1 && networkId != 3 && networkId != 4 && networkId != 42) ||
    newUmaDeployment;
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  if (derivativeVersions[networkId]?.DerivativeFactory?.isEnabled ?? true) {
    const keys = getKeysForNetwork(network, accounts);
    if (umaDeployment == true) {
      // Deploy CollateralWhitelist.
      await deploy(deployer, network, AddressWhitelist, {
        from: keys.deployer,
      });
      const collateralWhitelist = await getExistingInstance(
        web3,
        AddressWhitelist,
      );

      // Add CollateralWhitelist to finder.
      const umaFinder = await getExistingInstance(web3, UmaFinder);
      await umaFinder.methods
        .changeImplementationAddress(
          web3.utils.utf8ToHex(interfaceName.CollateralWhitelist),
          collateralWhitelist.options.address,
        )
        .send({
          from: keys.deployer,
        });

      // Add the testnet ERC20 as the default collateral currency (USDC for our use case)
      await deploy(deployer, network, TestnetERC20, 'USD Coin', 'USDC', 6, {
        from: keys.deployer,
      });
      const collateralToken = await getExistingInstance(web3, TestnetERC20);
      await collateralWhitelist.methods
        .addToWhitelist(collateralToken.options.address)
        .send({
          from: keys.deployer,
        });

      // Add the identifier for a currency pair (EUR/USD for our use case)
      const identifierWhitelist = await getExistingInstance(
        web3,
        IdentifierWhitelist,
      );
      const identifierBytes = web3.utils.utf8ToHex('EUR/USD');
      await identifierWhitelist.methods
        .addSupportedIdentifier(identifierBytes)
        .send({ from: keys.deployer });
    }
    const synthereumSyntheticTokenFactory = await getExistingInstance(
      web3,
      SynthereumSyntheticTokenFactory,
    );
    //hardat
    if (FeePayerPartyLib.setAsDeployed) {
      const { contract: feePayerPartyLib } = await deploy(
        deployer,
        network,
        FeePayerPartyLib,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await PerpetualPositionManagerPoolPartyLib.link(feePayerPartyLib);
        await PerpetualLiquidatablePoolPartyLib.link(feePayerPartyLib);
        await PerpetualPoolPartyLib.link(feePayerPartyLib);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, FeePayerPartyLib, {
        from: keys.deployer,
      });
      await deployer.link(FeePayerPartyLib, [
        PerpetualPositionManagerPoolPartyLib,
        PerpetualLiquidatablePoolPartyLib,
        PerpetualPoolPartyLib,
      ]);
    }
    //hardhat
    if (PerpetualPositionManagerPoolPartyLib.setAsDeployed) {
      const {
        contract: perpetualPositionManagerPoolPartyLib,
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
          perpetualPositionManagerPoolPartyLib,
        );
        await PerpetualPoolPartyLib.link(perpetualPositionManagerPoolPartyLib);
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
      const { contract: perpetualLiquidatablePoolPartyLib } = await deploy(
        deployer,
        network,
        PerpetualLiquidatablePoolPartyLib,
        {
          from: keys.deployer,
        },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await PerpetualPoolPartyLib.link(perpetualLiquidatablePoolPartyLib);
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
      const { contract: perpetualPoolPartyLib } = await deploy(
        deployer,
        network,
        PerpetualPoolPartyLib,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SynthereumDerivativeFactory.link(perpetualPoolPartyLib);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, PerpetualPoolPartyLib, {
        from: keys.deployer,
      });
      await deployer.link(PerpetualPoolPartyLib, SynthereumDerivativeFactory);
    }

    // Deploy derivative factory
    await deploy(
      deployer,
      network,
      SynthereumDerivativeFactory,
      umaDeployment
        ? (await getExistingInstance(web3, UmaFinder)).options.address
        : umaContracts[networkId].finderAddress,
      synthereumFinder.options.address,
      umaDeployment
        ? (await getExistingInstance(web3, Timer)).options.address
        : ZERO_ADDRESS,
      { from: keys.deployer },
    );

    const derivativeFactory = await getExistingInstance(
      web3,
      SynthereumDerivativeFactory,
    );
    const factoryInterface = await web3.utils.stringToHex('DerivativeFactory');
    await synthereumFactoryVersioning.methods
      .setFactory(
        factoryInterface,
        derivativeVersions[networkId]?.DerivativeFactory?.version ?? 2,
        derivativeFactory.options.address,
      )
      .send({ from: maintainer });
    console.log('DerivativeFactory adeed to synthereumFactoryVersioning');
    if (umaDeployment == true) {
      const registry = await getExistingInstance(web3, Registry);
      await registry.methods
        .addMember(
          RegistryRolesEnum.CONTRACT_CREATOR,
          derivativeFactory.options.address,
        )
        .send({ from: keys.deployer });
    }
  }
};
