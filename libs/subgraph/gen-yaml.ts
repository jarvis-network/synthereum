import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const filePath = join(__dirname, 'subgraph.yaml');
const outputFilePath = join(__dirname, 'temporary-subgraph-kovan.yaml');

let synthYaml = readFileSync(filePath).toString();

const DERIV_FACTORY_KOVAN = '0x1d17adfe4ed05411e590646c378c777068250358';
const DERIV_FACTORY_START_BLOCK = 23009291;

synthYaml = synthYaml
  .replace(/network: mainnet/g, 'network: kovan')
  .replace(
    /address: .*? #TAG:deriv-factory-1/,
    `address: "${DERIV_FACTORY_KOVAN}"`,
  )
  .replace(
    /startBlock: .*? #TAG:deriv-factory-1/,
    `startBlock: ${DERIV_FACTORY_START_BLOCK}`,
  );

writeFileSync(outputFilePath, synthYaml);
