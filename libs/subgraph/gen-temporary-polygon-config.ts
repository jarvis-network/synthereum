import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

const filePath = join(__dirname, 'subgraph.yaml');
const outputFilePath = join(__dirname, 'temporary-subgraph-polygon.yaml');

let synthYaml = readFileSync(filePath).toString();

const NEW_DEPLOYER_KOVAN = '0x8FEceC5629EED60D18Fd3438aae4a8E69723D190';
const NEW_DEPLOYER_START_BLOCK = 17614189;

synthYaml = synthYaml
  .replace(/network: mainnet/g, 'network: matic')
  .replace(/address: .*? #TAG:new-deployer/, `address: "${NEW_DEPLOYER_KOVAN}"`)
  .replace(
    /startBlock: .*? #TAG:new-deployer/,
    `startBlock: ${NEW_DEPLOYER_START_BLOCK}`,
  );

const config = yaml.load(synthYaml);
config.dataSources.shift();
config.templates.shift();
config.templates.shift();

writeFileSync(outputFilePath, yaml.dump(config));
