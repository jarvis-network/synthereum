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
const SelfMintingPerpetualLiquidatableMultiPartyLib = artifacts.require(
  'SelfMintingPerpetualLiquidatableMultiPartyLib',
);
const SelfMintingPerpetualPositionManagerMultiPartyLib = artifacts.require(
  'SelfMintingPerpetualPositionManagerMultiPartyLib',
);
const SelfMintingPerpetualMultiPartyLib = artifacts.require(
  'SelfMintingPerpetualMultiPartyLib',
);

const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const SelfMintingDerivativeFactory = artifacts.require(
  'SelfMintingDerivativeFactory',
);
const UmaFinder = artifacts.require('Finder');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const Timer = artifacts.require('Timer');
const Registry = artifacts.require('Registry');
const selfMintingVersions = require('../data/selfMinting-versions.json');
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
  if (
    selfMintingVersions[networkId]?.SelfMintingDerivativeFactory?.isEnabled ??
    true
  ) {
    const keys = getKeysForNetwork(network, accounts);
    if (umaDeployment == true) {
      const collateralWhitelist = await getExistingInstance(
        web3,
        AddressWhitelist,
      );
      // Add the testnet ERC20 as the default collateral currency (USDC for our use case)
      await deploy(
        deployer,
        network,
        TestnetSelfMintingERC20,
        'JRT Token',
        'JRT',
        18,
        {
          from: keys.deployer,
        },
      );
      const collateralToken = await getExistingInstance(
        web3,
        TestnetSelfMintingERC20,
      );
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
      const identifierBytes = web3.utils.utf8ToHex('EUR/JRT');
      await identifierWhitelist.methods
        .addSupportedIdentifier(identifierBytes)
        .send({ from: keys.deployer });
    }
    //hardat
    if (FeePayerPartyLib.setAsDeployed) {
      const feePayerPartyLib = await FeePayerPartyLib.at(
        (await getExistingInstance(web3, FeePayerPartyLib)).options.address,
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SelfMintingPerpetualPositionManagerMultiPartyLib.link(
          feePayerPartyLib,
        );
        await SelfMintingPerpetualLiquidatableMultiPartyLib.link(
          feePayerPartyLib,
        );
        await SelfMintingPerpetualMultiPartyLib.link(feePayerPartyLib);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, FeePayerPartyLib, {
        from: keys.deployer,
        overwrite: false,
      });
      await deployer.link(FeePayerPartyLib, [
        SelfMintingPerpetualPositionManagerMultiPartyLib,
        SelfMintingPerpetualLiquidatableMultiPartyLib,
        SelfMintingPerpetualMultiPartyLib,
      ]);
    }
    //hardhat
    if (SelfMintingPerpetualPositionManagerMultiPartyLib.setAsDeployed) {
      const {
        contract: selfMintingPerpetualPositionManagerMultiPartyLib,
      } = await deploy(
        deployer,
        network,
        SelfMintingPerpetualPositionManagerMultiPartyLib,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SelfMintingPerpetualLiquidatableMultiPartyLib.link(
          selfMintingPerpetualPositionManagerMultiPartyLib,
        );
        await SelfMintingPerpetualMultiPartyLib.link(
          selfMintingPerpetualPositionManagerMultiPartyLib,
        );
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      //
      await deploy(
        deployer,
        network,
        SelfMintingPerpetualPositionManagerMultiPartyLib,
        {
          from: keys.deployer,
        },
      );
      await deployer.link(SelfMintingPerpetualPositionManagerMultiPartyLib, [
        SelfMintingPerpetualLiquidatableMultiPartyLib,
        SelfMintingPerpetualMultiPartyLib,
      ]);
    }
    //hardhat
    if (SelfMintingPerpetualLiquidatableMultiPartyLib.setAsDeployed) {
      const {
        contract: selfMintingPerpetualLiquidatableMultiPartyLib,
      } = await deploy(
        deployer,
        network,
        SelfMintingPerpetualLiquidatableMultiPartyLib,
        {
          from: keys.deployer,
        },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SelfMintingPerpetualMultiPartyLib.link(
          selfMintingPerpetualLiquidatableMultiPartyLib,
        );
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(
        deployer,
        network,
        SelfMintingPerpetualLiquidatableMultiPartyLib,
        {
          from: keys.deployer,
        },
      );
      await deployer.link(
        SelfMintingPerpetualLiquidatableMultiPartyLib,
        SelfMintingPerpetualMultiPartyLib,
      );
    }
    //hardhat
    if (SelfMintingPerpetualMultiPartyLib.setAsDeployed) {
      const { contract: selfMintingPerpetualMultiPartyLib } = await deploy(
        deployer,
        network,
        SelfMintingPerpetualMultiPartyLib,
        {
          from: keys.deployer,
        },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SelfMintingDerivativeFactory.link(
          selfMintingPerpetualMultiPartyLib,
        );
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, SelfMintingPerpetualMultiPartyLib, {
        from: keys.deployer,
      });
      await deployer.link(
        SelfMintingPerpetualMultiPartyLib,
        SelfMintingDerivativeFactory,
      );
    }

    // Deploy derivative factory
    await deploy(
      deployer,
      network,
      SelfMintingDerivativeFactory,
      umaDeployment
        ? (await getExistingInstance(web3, UmaFinder)).options.address
        : umaContracts[networkId].finderAddress,
      synthereumFinder.options.address,
      umaDeployment
        ? (await getExistingInstance(web3, Timer)).options.address
        : ZERO_ADDRESS,
      { from: keys.deployer },
    );

    const selfMintingDerivativeFactory = await getExistingInstance(
      web3,
      SelfMintingDerivativeFactory,
    );
    await synthereumFactoryVersioning.methods
      .setSelfMintingFactory(
        selfMintingVersions[networkId]?.SelfMintingDerivativeFactory?.version ??
          1,
        selfMintingDerivativeFactory.options.address,
      )
      .send({ from: maintainer });
    console.log(
      'SelfMintingDerivativeFactory added to synthereumFactoryVersioning',
    );
    if (umaDeployment == true) {
      const registry = await getExistingInstance(web3, Registry);
      await registry.methods
        .addMember(
          RegistryRolesEnum.CONTRACT_CREATOR,
          selfMintingDerivativeFactory.options.address,
        )
        .send({ from: keys.deployer });
    }
  }
};
