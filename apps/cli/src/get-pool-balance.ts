require('dotenv').config();
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { getPoolBalances } from '@jarvis-network/synthereum-contracts/dist/src/core/pool-utils';
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { formatAmount } from '@jarvis-network/web3-utils/base/big-number';
import { basename } from 'path';

async function main() {
  console.log(`[${basename(__filename)}]: starting`);
  const netId = parseSupportedNetworkId(42);
  const web3 = getInfuraWeb3(netId);
  const realm = await loadRealm(web3, netId);
  let balances = await getPoolBalances(realm, 'v1');
  const result = balances.map(([sym, bal]) => ({
    Symbol: sym,
    'Pool v1 Balance': `${formatAmount(bal)} USDC`,
    'Pool v1 Address': realm.pools['v1'][sym].address,
  }));
  console.table(result);
  balances = await getPoolBalances(realm, 'v2');
  const resultv2 = balances.map(([sym, bal]) => ({
    Symbol: sym,
    'Pool v2 Balance': `${formatAmount(bal)} USDC`,
    'Pool v2 Address': realm.pools['v2'][sym].address,
  }));
  console.table(resultv2);
}

main()
  .then(_ => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1);
  });
