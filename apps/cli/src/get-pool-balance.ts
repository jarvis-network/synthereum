require('dotenv').config();
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { getPoolBalances } from '@jarvis-network/synthereum-contracts/dist/src/core/pool-utils';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { formatAmount } from '@jarvis-network/web3-utils/base/big-number';
import { basename } from 'path';

async function main() {
  console.log(`[${basename(__filename)}]: starting`);
  const netId = parseSupportedNetworkId(42);
  const web3 = getInfuraWeb3(netId);
  const realm = await loadRealm(web3, netId);
  const balances = await getPoolBalances(realm);
  const result = balances.map(([sym, bal]) => ({
    Symbol: sym,
    'Pool Balance': `${formatAmount(bal)} USDC`,
    'Pool Address': realm.pools['v1'][sym].address,
  }));
  console.table(result);
}

main()
  .then(_ => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1);
  });
