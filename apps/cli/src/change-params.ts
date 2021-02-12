require('dotenv').config();
import Web3 from 'web3';
import {
  parseSupportedNetworkId,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { updateV2PoolParameters } from '@jarvis-network/synthereum-contracts/dist/src/core/pool-utils';
import { getInfuraEndpoint } from '@jarvis-network/web3-utils/apis/infura';
import { LedgerProvider } from '@umaprotocol/truffle-ledger-provider';
import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';
import { wei } from '@jarvis-network/web3-utils/base/big-number';
import {
  setPrivateKey_DevelopmentOnly,
  Web3On,
} from '@jarvis-network/web3-utils/eth/web3-instance';
import { log } from './utils/log';
import {
  assertIsString,
  parseFiniteFloat,
} from '@jarvis-network/web3-utils/base/asserts';
import { synthereumConfig } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { Fees } from '@jarvis-network/synthereum-contracts/dist/src/config/types';
import { TxOptions } from '@jarvis-network/web3-utils/eth/contracts/send-tx';
import { t } from '@jarvis-network/web3-utils/base/meta';

main()
  .then(_ => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1);
  });

async function main() {
  const netId = parseSupportedNetworkId(1);
  log('Starting on network:', netId);

  const gasPrice = parseFiniteFloat(process.env.GAS_PRICE);
  log('Using gas price:', gasPrice);

  const localRpc = 'http://localhost:8545';
  const infuraEndPoint = getInfuraEndpoint(netId, 'https');
  const customRpcUrl = assertIsString(process.env.CUSTOM_RPC_URL);
  log('Endpoints:', { localRpc, infuraEndPoint, customRpcUrl });

  const realmParams = {
    admin: t(true, customRpcUrl, netId),
    maintainer: t(false, customRpcUrl, netId),
  };

  const synCfg = synthereumConfig[netId];
  const txOptions: TxOptions = {
    gasPrice,
    printInfo: {
      log,
    },
  };

  log('-----------------------------');
  log('Starting to update Maintainer-managed parameters');

  const realmMaintainer = await getRealm(...realmParams.maintainer);
  await updateV2PoolParameters(
    realmMaintainer,
    {
      newFees: (synCfg.fees as unknown) as Fees<'mainnet'>,
      perPool: {
        jEUR: {
          startingCollateralization: wei('1824000'),
        },
        jGBP: {
          startingCollateralization: wei('2061000'),
        },
      },
      allowContractsUpdate: {
        enabled: true,
      },
    },
    txOptions,
  );

  log('-----------------------------');
  log('Starting to update Admin-managed parameters');

  const realmAdmin = await getRealm(...realmParams.admin);
  await updateV2PoolParameters(
    realmAdmin,
    {
      lp: {
        previousAddress: A<1>('0x85e0d7f67b909f1a815fbc8bb39ea76b8ba6994f'),
        newAddress: synCfg.roles.liquidityProvider,
      },
      validator: {
        previousAddress: A<1>('0xcb3508a63176c8a2d24f1d048374e80befe8a8a2'),
        newAddress: synCfg.roles.validator,
      },
    },
    txOptions,
  );

  log('All done.');
}

async function getRealm<Net extends SupportedNetworkId>(
  useLedger: boolean,
  rpcUrl: string,
  netId: Net,
) {
  log(
    'Creating web3 instance ' +
      (useLedger ? 'with Ledger' : 'with private key'),
  );
  const web3 = new Web3(
    !useLedger
      ? rpcUrl
      : new LedgerProvider({
          rpcUrl,
          accountsLength: 1,
          accountsOffset: 6,
          networkId: netId,
          askConfirm: false,
          paths: ["44'/60'/x'/0/0"],
        }),
  ) as Web3On<Net>;
  log('Web3 instance loaded');

  web3.eth.transactionConfirmationBlocks = 2;

  if (!useLedger) {
    log('Setting private key');
    setPrivateKey_DevelopmentOnly(
      web3,
      assertIsString(process.env.PRIVATE_KEY),
    );
  }

  const accounts = await web3.eth.getAccounts();
  log('Wallet accounts:', accounts);
  log('Using default account:', web3.defaultAccount);

  log('Loading realm...');
  const realm = await loadRealm(web3, netId);
  log('Realm loaded', { poolRegistry: realm.poolRegistry.address });
  return realm;
}
