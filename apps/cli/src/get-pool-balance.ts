import { parseSupportedNetworkId } from '@jarvis-network/synthereum-ts/dist/config';
import { loadRealm } from '@jarvis-network/synthereum-ts/dist/core/load-realm';
import {
  getPoolBalances,
  depositInAllPools,
} from '@jarvis-network/synthereum-ts/dist/core/pool-utils';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import {
  formatAmount,
  numberToWei,
  wei,
} from '@jarvis-network/core-utils/dist/base/big-number';
import { setPrivateKey_DevelopmentOnly } from '@jarvis-network/core-utils/dist/eth/web3-instance';
import {
  assertNotNull,
  parseFiniteFloat,
} from '@jarvis-network/core-utils/dist/base/asserts';
import { getTokenBalance } from '@jarvis-network/core-utils/dist/eth/contracts/erc20';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-ts/dist/core/types/realm';
import {
  assertIsSupportedPoolVersion,
  PoolVersion,
  poolVersions,
} from '@jarvis-network/synthereum-ts/dist/core/types/pools';
import { log } from '@jarvis-network/core-utils/dist/logging';
import { assertIsAddress } from '@jarvis-network/core-utils/dist/eth/address';
import { t } from '@jarvis-network/core-utils/dist/base/meta';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

const { table } = console;

async function main() {
  log('Starting');
  const netId = parseSupportedNetworkId(process.env.NETWORK_ID);
  const web3 = getInfuraWeb3(netId);
  log('Web3 instance loaded');
  setPrivateKey_DevelopmentOnly(web3, assertNotNull(process.env.PRIVATE_KEY));
  log('Private key set - using', { address: web3.defaultAccount });
  const realm = await loadRealm(web3, netId);
  log('Realm loaded', { poolRegistry: realm.poolRegistry!.address });

  for (const v of poolVersions) {
    log(`Getting ${v} balances`);
    await printPoolBalance(realm, v);
  }

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
  await depositInAllPools(realm, poolVersion, numberToWei(depositAmount), {
    printInfo: { log },
  });
  log('Deposit complete. Getting v4 balances');
  await printPoolBalance(realm, poolVersion);
}

async function printPoolBalance(
  realm: SynthereumRealmWithWeb3,
  version: PoolVersion,
) {
  const balances = await getPoolBalances(realm, version);
  const pools = assertNotNull(realm.pools![version]);
  const result = assertNotNull(balances)
    .map(([sym, bal]) => t(sym, bal, assertNotNull(pools![sym])))
    .map(([sym, bal, pool]) => ({
      Symbol: sym,
      [`'${version}' Pool Balance`]: `${formatAmount(bal)} USDC`,
      [`'${version}' Pool Address`]: pool.address,
      'Synthetic Token Address': `${pool.syntheticToken.address} (${pool.syntheticToken.symbol})`,
      'Collateral Token Address': `${pool.collateralToken.address} (${pool.collateralToken.symbol})`,
      'Derivative Address': pool.derivative.address,
    }));
  table(result);
}

main()
  .then(_ => process.exit(0))
  .catch(err => {
    log(err);
    process.exit(1);
  });
