import { log, logTable } from '@jarvis-network/core-utils/dist/logging';
import { loadRealm } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/load';
import { SelfMintingVersion } from '@jarvis-network/synthereum-ts/dist/core/types/self-minting-derivatives';
import { SelfMintingRealmWithWeb3 } from '@jarvis-network/synthereum-ts/dist/core/types/realm';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

import { createCliApp } from './common/create-cli-app';
import { buildCli } from './common/cli-config';

createCliApp(buildCli(__filename), async ({ web3, netId }) => {
  const realm = await loadRealm(web3, netId);
  log('Realm loaded', {
    selfMintingRegistry: realm.selfMintingRegistry?.address,
  });
  printPoolBalance(realm, 'v1');
});
function printPoolBalance(
  realm: SelfMintingRealmWithWeb3,
  version: SelfMintingVersion,
) {
  const derivatives = assertNotNull(realm.selfMintingDerivatives[version]);
  const result = Object.entries(derivatives).map(([symbol, derivative]) => ({
    Symbol: symbol,
    [`'${version}' Derivative Address`]: derivative?.address,
    'Synthetic Token Address': `${derivative?.static.syntheticToken.address} (${derivative?.static.syntheticToken.symbol})`,
    'Collateral Token Address': `${derivative?.static.collateralToken.address} (${derivative?.static.collateralToken.symbol})`,
  }));
  logTable(result);
}
