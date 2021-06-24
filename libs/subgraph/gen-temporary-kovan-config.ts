import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const filePath = join(__dirname, 'subgraph.yaml');
const outputFilePath = join(__dirname, 'temporary-subgraph-kovan.yaml');

let synthYaml = readFileSync(filePath).toString();

const OLD_FACTORY_KOVAN = '0x1d17adfe4ed05411e590646c378c777068250358';
const OLD_FACTORY_START_BLOCK = 23009290;

const NEW_DEPLOYER_KOVAN = '0x96452fFc312a5Bbf2C1Bf25F2196d3dC4ebe109b';
const NEW_DEPLOYER_START_BLOCK = 25179176;

synthYaml = synthYaml
  .replace(/network: mainnet/g, 'network: kovan')
  .replace(/address: .*? #TAG:old-factory/, `address: "${OLD_FACTORY_KOVAN}"`)
  .replace(
    /startBlock: .*? #TAG:old-factory/,
    `startBlock: ${OLD_FACTORY_START_BLOCK}`,
  )
  .replace(/address: .*? #TAG:new-deployer/, `address: "${NEW_DEPLOYER_KOVAN}"`)
  .replace(
    /startBlock: .*? #TAG:new-deployer/,
    `startBlock: ${NEW_DEPLOYER_START_BLOCK}`,
  );

writeFileSync(outputFilePath, synthYaml);
