require('dotenv').config();
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import {
  getPoolBalances,
  depositInAllPools,
} from '@jarvis-network/synthereum-contracts/dist/src/core/pool-utils';
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import {
  formatAmount,
  numberToWei,
  wei,
} from '@jarvis-network/web3-utils/base/big-number';
import { setPrivateKey_DevelopmentOnly } from '@jarvis-network/web3-utils/eth/web3-instance';
import { parseFiniteFloat } from '@jarvis-network/web3-utils/base/asserts';
import { getTokenBalance } from '@jarvis-network/web3-utils/eth/contracts/erc20';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-contracts/dist/src/core/types/realm';
import {
  assertIsSupportedPoolVersion,
  PoolVersion,
} from '@jarvis-network/synthereum-contracts/dist/src/core/types/pools';
import { log } from './utils/log';
import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';

async function main() {
  log('Starting');
  const netId = parseSupportedNetworkId(42);
  const web3 = getInfuraWeb3(netId);
  log('Web3 instance loaded');
  setPrivateKey_DevelopmentOnly(web3, process.env.PRIVATE_KEY!);
  log('Private key set - using', { address: web3.defaultAccount });
  const realm = await loadRealm(web3, netId);
  log('Realm loaded', { poolRegistry: realm.poolRegistry.address });
  log('Getting v1 balances');
  await printPoolBalance(realm, 'v1');
  log('Getting v2 balances');
  await printPoolBalance(realm, 'v2');
  const depositAmount = parseFiniteFloat(process.env.TOTAL_DEPOSIT_AMOUNT);
  if (depositAmount <= 0) return;
  const poolVersion = assertIsSupportedPoolVersion(
    process.env.POOL_VERSION_TO_DEPOSIT_INTO,
  );
  const sender = assertIsAddress<42>(web3.defaultAccount);
  log(`Depositing ${depositAmount} USDC in ${poolVersion}`, {
    sender,
    ethBalance: formatAmount(wei(await web3.eth.getBalance(sender))),
    usdcBalance: formatAmount(
      await getTokenBalance(realm.collateralToken, sender),
    ),
  });
  await depositInAllPools(realm, poolVersion, numberToWei(depositAmount));
  log('Deposit complete. Getting v2 balances');
  await printPoolBalance(realm, poolVersion);
}

async function printPoolBalance(
  realm: SynthereumRealmWithWeb3<'kovan'>,
  version: PoolVersion,
) {
  let balances = await getPoolBalances(realm, version);
  const result = balances.map(([sym, bal]) => ({
    Symbol: sym,
    [`'${version}' Pool Balance`]: `${formatAmount(bal)} USDC`,
    [`'${version}' Pool Address`]: realm.pools[version][sym].address,
    'Synthetic Token Address':
      realm.pools[version][sym].syntheticToken.address +
      ` (${realm.pools[version][sym].syntheticToken.symbol})`,
    'Collateral Token Address':
      realm.pools[version][sym].collateralToken.address +
      ` (${realm.pools[version][sym].collateralToken.symbol})`,
  }));
  console.table(result);
}

main()
  .then(_ => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1);
  });
