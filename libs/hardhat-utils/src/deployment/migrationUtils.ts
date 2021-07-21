/* eslint-disable import/first */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable require-await */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'fs';
import path from 'path';

import {
  NetworkId,
  networkNameToId,
} from '@jarvis-network/core-utils/dist/eth/networks';
import {
  logTransactionOutput,
  TxLogParams,
} from '@jarvis-network/core-utils/dist/eth/contracts/print-tx';
import type { TransactionConfig } from 'web3-core';
import type Web3 from 'web3';
import { Web3On } from 'libs/core-utils/dist/eth/web3-instance';
import { readJsonFromFile } from '@jarvis-network/core-utils/dist/base/fs';

const tdr = require('truffle-deploy-registry');

// To prevent a call to migrate --reset from overwriting prevously deployed contract instances, use the following
// command line parameters:
// --keep_finder prevents the Finder contract from being redeployed if previously deployed.
// --keep_token prevents the VotingToken contract from being redeployed if previously deployed.
// --keep_system keeps all contracts not covered by the other arguments from being replaced.
// Note: to keep all contracts intact (essentially a no-op), one would need to provide all the above arguments.
const argv = require('minimist')(process.argv.slice(), {
  boolean: ['keep_finder', 'keep_token', 'keep_system'],
});

function isPublicNetwork(network: string) {
  return (
    network !== 'hardhat' &&
    Object.keys(networkNameToId).some(name => network.startsWith(name))
  );
}

// Determines whether the network requires timestamps to be manually controlled or not.
function enableControllableTiming(network: string) {
  // Any non public network should have controllable timing.
  return !isPublicNetwork(network);
}

function shouldCommitDeployment(network: string) {
  // ci is included here just for testing the process of saving deployments.
  return network === 'ci' || isPublicNetwork(network);
}

// eslint-disable-next-line @typescript-eslint/ban-types
function isEmptyObject(obj: object) {
  return Object.entries(obj).length === 0 && obj.constructor === Object;
}

// Extracts the transaction options from a transaction arg list. If the arg list doesn't have a transaction options
// element, then it creates one and returns it.
function getTxnOptions(
  argList: TransactionConfig[],
): Partial<TransactionConfig & { overwrite: boolean }> {
  const emptyTxnOptions = {};
  if (argList.length === 0) {
    // No arguments, so add and return the empty txn options object.
    argList.push(emptyTxnOptions);
    return emptyTxnOptions;
  }
  // Determine if the last element is the txn options object.
  const lastElement = argList[argList.length - 1];
  if (
    lastElement.from === undefined &&
    lastElement.gas === undefined &&
    lastElement.gasPrice === undefined &&
    lastElement.value === undefined &&
    !isEmptyObject(lastElement)
  ) {
    // The last element is not the txn options object, so use the empty options defined at the top.
    argList.push(emptyTxnOptions);
    return emptyTxnOptions;
  }
  // The last element is the txn options element, so return it.
  return lastElement;
}

// Deploys a contract (if the CLI options allow) and adds it to the committed contract registry.
async function deploy(
  web3: Web3On<NetworkId>,
  deployer: { deploy: (...args: any[]) => any },
  network: string,
  contractType: {
    contractName: any;
    isDeployed: () => any;
    setAsDeployed: (arg0: any) => void;
    autoGas: boolean;
    new: (...args: any[]) => any;
    deployed: () => any;
  },
  ...args: [...any]
) {
  // Extract the txn options element from the contract arguments.
  const txnOptions = getTxnOptions(args);

  // Each portion of the system can have its overwrite varied independently.
  switch (contractType.contractName) {
    case 'Finder':
      txnOptions.overwrite = !argv.keep_finder;
      break;
    case 'VotingToken':
      txnOptions.overwrite = !argv.keep_token;
      break;
    case 'Migrations':
      // Always redeploy the Migrations contract.
      txnOptions.overwrite = true;
      break;
    default:
      txnOptions.overwrite = !argv.keep_system;
      break;
  }

  // If the contract will be overwritten or it is not yet deployed, a new one will be deployed.
  const willDeploy = txnOptions.overwrite || !contractType.isDeployed();

  // Deploy contract.
  let contractInstance;
  // hardhat
  if (contractType.setAsDeployed) {
    if (isPublicNetwork(network)) {
      // Public networks don't support contract overwrite
      delete txnOptions.overwrite;
    }
    try {
      contractType.autoGas = true;
      contractInstance = await contractType.new(...args);
      const txhash = contractInstance.transactionHash;
      const enableLogging =
        process.env.HARDHAT_PRINT_TRUFFLE_LIKE_DEPLOYMENT_INFO ?? 'true';
      if (enableLogging === 'true') {
        await logTransactionOutput({
          log: console.log,
          web3,
          txhash,
          contractName: contractType.contractName,
          contractAddress: contractInstance.address,
        });
      }

      contractType.setAsDeployed(contractInstance);
    } catch (e) {
      console.log({ e, args, contractName: contractType.contractName });
    }
  }

  // Truffle
  else {
    await deployer.deploy(contractType, ...args);
    contractInstance = await contractType.deployed();
  }

  // Add to the registry.
  await addToTdr(contractInstance, network);

  // Add to truffle verification registry
  if (!tdr.isDryRunNetworkName(network) && shouldCommitDeployment(network)) {
    // We do the check here as otherwise getting network_id will throw an error
    await addToTvr(
      contractInstance.address,
      args,
      network,
      contractInstance.constructor.network_id,
    );
  }

  // Return relevant info about the contract.
  return {
    contract: contractInstance,
    didDeploy: willDeploy,
  };
}

async function setToExistingAddress(
  network: string,
  contractType: { address: any; at: (arg0: any) => any },
  address: string,
) {
  // Set the contract address locally, which will be reflected in the truffle artifacts.
  contractType.address = address;

  // Get a contract instance to pass to tdr.
  const instance = await contractType.at(address);

  // Add to the registry.
  await addToTdr(instance, network);

  return instance;
}

// Maps key ordering to key names.
function getKeysForNetwork(network: string, accounts: string) {
  // Must be exactly equal to a public network name to exclude the _mnemonic network configurations that don't use
  // gcloud key encryption.
  if (Object.keys(networkNameToId).some(name => name === network)) {
    return {
      deployer: accounts[0],
      registry: accounts[1],
    };
  }
  return {
    deployer: accounts[0],
    registry: accounts[0],
  };
}

async function addToTdr(instance: any, network: string) {
  // Probably redundant checks, but useful in case of future modifications.
  if (!tdr.isDryRunNetworkName(network) && shouldCommitDeployment(network)) {
    await tdr.appendInstance(instance);
  }
}

// "Tvr" - Truffle verification registry
async function addToTvr(
  address: string,
  args: any[],
  network: string,
  networkId: number,
) {
  // Adds in constructor args for contracts in the k, v store
  // e.g. Produces a networks/1_args.json
  // with the structure
  // { "address": "args" }
  if (!tdr.isDryRunNetworkName(network) && shouldCommitDeployment(network)) {
    const tvrPath = path.join(
      process.cwd(),
      'networks',
      `${networkId}_args.json`,
    );
    type TvrData = { [address: string]: any[] };

    let tvrData: TvrData = {};

    // If file exists, just read it
    if (fs.existsSync(tvrPath)) {
      tvrData = (await readJsonFromFile(tvrPath)) as TvrData;
    }

    // Remove { 'from': ... } thats present in the deployment args
    // As well as empty objects
    // And destructure the single tuple (with rawValue keys)
    const argsFixed = args
      .filter(
        (x: { from?: any }) =>
          !x.from && (typeof x === 'object' ? Object.keys(x).length > 0 : true),
      )
      .map((x: { rawValue: any }) => {
        // Tuple
        if (x.rawValue) return [x.rawValue];
        return x;
      });

    // Save to file
    fs.writeFileSync(
      tvrPath,
      JSON.stringify({ ...tvrData, [address]: argsFixed }, null, 4),
    );
  }
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const MAX_UINT_VAL =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const RegistryRolesEnum = {
  OWNER: '0',
  CONTRACT_CREATOR: '1',
};

// States for an EMP's Liquidation to be in.
const LiquidationStatesEnum = {
  UNINITIALIZED: '0',
  PRE_DISPUTE: '1',
  PENDING_DISPUTE: '2',
  DISPUTE_SUCCEEDED: '3',
  DISPUTE_FAILED: '4',
};

const interfaceName = {
  FinancialContractsAdmin: 'FinancialContractsAdmin',
  Oracle: 'Oracle',
  Registry: 'Registry',
  Store: 'Store',
  IdentifierWhitelist: 'IdentifierWhitelist',
  CollateralWhitelist: 'CollateralWhitelist',
  FundingRateStore: 'FundingRateStore',
  OptimisticOracle: 'OptimisticOracle',
};

// Attempts to execute a promise and returns false if no error is thrown,
// or an Array of the error messages
async function didContractThrow(promise: Promise<any>) {
  try {
    await promise;
  } catch (error) {
    return error.message.match(
      /[invalid opcode|out of gas|revert]/,
      `Expected throw, got '${error}' instead`,
    );
  }
  return false;
}

module.exports = {
  enableControllableTiming,
  deploy,
  setToExistingAddress,
  getKeysForNetwork,
  addToTdr,
  isPublicNetwork,
  ZERO_ADDRESS,
  MAX_UINT_VAL,
  RegistryRolesEnum,
  LiquidationStatesEnum,
  interfaceName,
  didContractThrow,
};
