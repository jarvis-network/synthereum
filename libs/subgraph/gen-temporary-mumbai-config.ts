import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

const filePath = join(__dirname, 'subgraph.yaml');
const outputFilePath = join(__dirname, 'temporary-subgraph-mumbai.yaml');

let synthYaml = readFileSync(filePath).toString();

const NEW_DEPLOYER_KOVAN = '0x804A40d12FdeD71D41cD69a0054d371a80Cc84da';
const NEW_DEPLOYER_START_BLOCK = 16712052;

synthYaml = synthYaml
  .replace(/network: mainnet/g, 'network: mumbai')
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
