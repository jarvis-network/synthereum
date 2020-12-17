require('dotenv').config();
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { getPoolBalances } from '@jarvis-network/synthereum-contracts/dist/src/core/pool-utils';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { loadRealm } from '@jarvis-network/synthereum-contracts/dist/src/core/load-realm';
import { formatAmount } from '@jarvis-network/web3-utils/base/big-number';

async function main() {
  const netId = parseSupportedNetworkId(42);
  const web3 = getInfuraWeb3(netId);
  const realm = await loadRealm(web3, netId);
  const balances = await getPoolBalances(realm);
  const result = Object.fromEntries(
    balances.map(([sym, bal]) => [
      `${sym} pool balance`,
      `${formatAmount(bal)} USDC`,
    ]),
  )
  console.log(result);
}

main()
  .then(_ => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1);
  })
