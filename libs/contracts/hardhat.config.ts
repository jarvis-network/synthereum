import fs from 'fs';
import path from 'path';
import chalkPipe from 'chalk-pipe';
import { task } from 'hardhat/config';

// Etherscan verification stuff
import ethers from 'ethers';
import { HardhatPluginError } from 'hardhat/plugins';
import {
  TASK_COMPILE,
  TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT,
} from 'hardhat/builtin-tasks/task-names';
import { extendEnvironment } from 'hardhat/config';
import {
  getVerificationStatus,
  verifyContract,
} from '@nomiclabs/hardhat-etherscan/dist/src/etherscan/EtherscanService';
import { defaultEtherscanConfig } from '@nomiclabs/hardhat-etherscan/dist/src/config';
import { getLongVersion } from '@nomiclabs/hardhat-etherscan/dist/src/solc/version';
import { EtherscanVerifyRequest } from '@nomiclabs/hardhat-etherscan/dist/src/etherscan/EtherscanVerifyContractRequest';
import '@nomiclabs/hardhat-truffle5';
import 'solidity-coverage';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-gas-reporter';

// Solc version defined here so etherscan-verification has access to it
const solcVersion = '0.6.12';

task('test')
  .addFlag('debug', 'Compile without optimizer')
  .setAction(async (taskArgs, hre, runSuper) => {
    const { debug } = taskArgs;

    if (debug) {
      // Network config changes
      hre.config.networks.hardhat.allowUnlimitedContractSize = true;
      hre.config.networks.hardhat.blockGasLimit = 0x1fffffffffffff;
      hre.config.networks.hardhat.gas = 12000000;

      console.log(chalkPipe('bold.underline')('Running tests in debug mode'));
    }

    await runSuper(taskArgs);
  });

task('etherscan-verification', 'Verifies contract on etherscan')
  .addParam('networkId', 'Network Id in networks directory. (e.g. 1,4,42)')
  .addOptionalParam('empLibAddress', 'EMPLib Address')
  .addOptionalParam('perpLibAddress', 'PerpLib Address')
  .setAction(async (taskArgs, hre) => {
    const { networkId, empLibAddress, perpLibAddress } = taskArgs;
    let url;

    if (networkId === '42') {
      url = 'https://api-kovan.etherscan.io/api';
      console.log(chalkPipe('yellow.bold')('Using kovan network'));
    } else if (networkId === '4') {
      url = 'https://api-rinkeby.etherscan.io/api';
      console.log(chalkPipe('yellow.bold')('Using rinkeby network'));
    } else if (networkId === '1') {
      url = 'https://api.etherscan.io/api';
      console.log(chalkPipe('yellow.bold')('Using mainnet network'));
    } else {
      url = '';
      console.log(
        chalkPipe('orange.bold')('Unable to automatically detect network'),
      );
    }

    defaultEtherscanConfig(hre.config, hre.config);

    if (
      hre.config.etherscan.apiKey === undefined ||
      hre.config.etherscan.apiKey.trim() === ''
    ) {
      throw new HardhatPluginError(
        '@nomiclabs/buidler-etherscan',
        'Please provide etherscan api token via buidler.config.js (etherscan.apiKey)',
      );
    }

    const deployedFilePath = path.join(
      __dirname,
      'networks',
      `${networkId}.json`,
    );
    const deployedArgsFilePath = path.join(
      __dirname,
      'networks',
      `${networkId}_args.json`,
    );

    if (!fs.existsSync(deployedFilePath)) {
      console.log(
        chalkPipe('red.bold')(
          `${deployedFilePath} not found, skipping verification...`,
        ),
      );
      return;
    }
    if (!fs.existsSync(deployedArgsFilePath)) {
      console.log(
        chalkPipe('red.bold')(
          `${deployedArgsFilePath} not found, skipping verification...`,
        ),
      );
      return;
    }

    const deployed = JSON.parse(fs.readFileSync(deployedFilePath, 'utf-8'));
    const deployedArgs = JSON.parse(
      fs.readFileSync(deployedArgsFilePath, 'utf-8'),
    );

    // Compile before verifying
    await hre.run(TASK_COMPILE);

    // Get library addresses:
    // - EMPLib
    /*let EMPLibAddress = empLibAddress;
    if (!EMPLibAddress) {
      try {
        EMPLibAddress = deployed.filter(({ contractName }) => contractName === "ExpiringMultiPartyLib")[0].address;
        console.log(chalkPipe("orange.bold")(`Found EMPLib address to be ${EMPLibAddress}`));
      } catch (e) {
        console.log(chalkPipe("red.bold")("EMPLib address not provided and was unable to find one"));
        return;
      }
    }
    // - PerpLib
    let PerpLibAddress = perpLibAddress;
    if (!PerpLibAddress) {
      try {
        PerpLibAddress = deployed.filter(({ contractName }) => contractName === "PerpetualLib")[0].address;
        console.log(chalkPipe("orange.bold")(`Found PerpLib address to be ${PerpLibAddress}`));
      } catch (e) {
        console.log(chalkPipe("red.bold")("PerpLib address not provided and was unable to find one"));
        return;
      }
    }

    const libraries = {
      "contracts/financial-templates/expiring-multiparty/ExpiringMultiPartyLib.sol": {
        ExpiringMultiPartyLib: `${EMPLibAddress}`
      },
      "contracts/financial-templates/perpetual-multiparty/PerpetualLib.sol": {
        PerpetualLib: `${PerpLibAddress}`
      }
    };*/

    const solcFullVersion = await getLongVersion(solcVersion);

    // Get the solc-input.json
    const solcInput = await hre.run(TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT);

    //solcInput.settings.libraries = libraries;

    for (const { contractName, address } of deployed) {
      if (!deployedArgs[address]) {
        console.log(
          chalkPipe('orange.bold')(
            `Unable to find constructor args for ${contractName} at ${address}, skipping verification...`,
          ),
        );
        continue;
      }

      // Get the saved constructor params
      const constructorArguments = deployedArgs[address];

      // ABI encode constructor params
      const abi = (await hre.artifacts.readArtifact(contractName)).abi;
      const constructorAbi = abi.filter(x => x.type === 'constructor')[0];
      let abiEncodedConstructorArgs = '';
      if (constructorAbi) {
        // Using ethers here because web3.js doesn't support custom tuple construction (e.g. FixedPoint)
        // https://github.com/ethereum/web3.js/issues/1241
        abiEncodedConstructorArgs = ethers.utils.defaultAbiCoder.encode(
          constructorAbi.inputs,
          constructorArguments,
        );

        // Remove '0x'
        abiEncodedConstructorArgs = abiEncodedConstructorArgs.slice(2);
      }

      // Format contract name according to etherscan
      // more info @ https://etherscan.io/apis#contracts
      const constractPath = Object.keys(solcInput.sources).filter(x =>
        x.includes(`/${contractName}.sol`),
      )[0];
      const etherscanContractName = `${constractPath}:${contractName}`;

      // Request on etherscan
      // JSON format - https://etherscan.io/apis#contracts
      const verificationRequest: EtherscanVerifyRequest = {
        apikey: hre.config.etherscan.apiKey,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: address,
        sourceCode: JSON.stringify(solcInput),
        contractname: `${etherscanContractName}`,
        codeformat: 'solidity-standard-json-input',
        compilerversion: solcFullVersion,
        constructorArguements: abiEncodedConstructorArgs,
      };

      try {
        console.log(
          chalkPipe('yellow.bold')(
            `Attempting to verify ${contractName} at ${address}`,
          ),
        );
        const response = await verifyContract(
          new URL(url),
          verificationRequest,
        );
        console.log(
          `Submitted ${contractName} contract at ${address} for verification on etherscan (GUID: ${response.message}). Waiting for verification result...`,
        );
        if (response.isVerificationSuccess()) {
          console.log(
            chalkPipe('green.bold')(
              `Successfully verified ${contractName} at ${address} on etherscan`,
            ),
          );
        } else if (response.isVerificationFailure()) {
          console.log(
            chalkPipe('red.bold')(
              `Failed to verified ${contractName} at ${address} on etherscan`,
            ),
          );
        }
      } catch (e) {
        if (e.toString().includes('already verified')) {
          console.log(
            chalkPipe('orange.bold')(
              `${contractName} at ${address} is already verified on etherscan`,
            ),
          );
        } else {
          console.log(
            chalkPipe('red.bold')(
              `Failed to verified ${contractName} at ${address} on etherscan`,
            ),
          );
        }
      }
    }
  });

module.exports = {
  solidity: {
    version: solcVersion,
    optimizer: {
      enabled: true,
      runs: 199,
    },
  },
  networks: {
    hardhat: {
      gas: 11500000,
      blockGasLimit: 11500000,
      allowUnlimitedContractSize: false,
      timeout: 1800000,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
  mocha: {
    timeout: 1800000,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
