import { log, logTable } from '@jarvis-network/core-utils/dist/logging';
import { loadRealm } from '@jarvis-network/synthereum-ts/dist/core/load-realm';
import { SelfMintingVersion } from '@jarvis-network/synthereum-ts/dist/core/types/self-minting-derivatives';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-ts/dist/core/types/realm';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

import { createCliApp } from './common/create-cli-app';
import { buildCli } from './common/cli-config';

createCliApp(buildCli(__filename), async ({ web3, netId }) => {
  const realm = await loadRealm(web3, netId);
  log('Realm loaded', {
    selfMintinglRegistry: realm.selfMintinglRegistry?.address,
  });
  printPoolBalance(realm, 'v1');
});
function printPoolBalance(
  realm: SynthereumRealmWithWeb3,
  version: SelfMintingVersion,
) {
  const derivatives = assertNotNull(realm.selfMintingDerivatives![version]);
  const result = Object.entries(derivatives).map(([symbol, derivative]) => ({
    Symbol: symbol,
    [`'${version}' Derivative Address`]: derivative?.address,
    'Synthetic Token Address': `${derivative?.syntheticToken.address} (${derivative?.syntheticToken.symbol})`,
    'Collateral Token Address': `${derivative?.collateralToken.address} (${derivative?.collateralToken.symbol})`,
  }));
  logTable(result);
}
