import { toBN } from 'web3-utils';

import { isString, throwError } from '../base/asserts';

import { NetworkName, Web3On } from './web3-instance';

export async function getBlockTimestamp<Net extends NetworkName>(
  web3: Web3On<Net>,
  blockNumber: number,
): Promise<number> {
  const { timestamp } = await web3.eth.getBlock(blockNumber);
  return isString(timestamp) ? Number.parseInt(timestamp, 10) : timestamp;
}

export async function getBlockAverageTime<Net extends NetworkName>(
  web3: Web3On<Net>,
  blockNumber: number,
  span: number,
): Promise<number> {
  const times = [];
  const firstBlock = await web3.eth.getBlock(blockNumber - span);
  let prevTimestamp = firstBlock.timestamp;
  for (let i = blockNumber - span + 1; i <= blockNumber; i++) {
    // FIXME
    // eslint-disable-next-line no-await-in-loop
    const block = await web3.eth.getBlock(i);
    const time = toBN(block.timestamp).sub(toBN(prevTimestamp));
    prevTimestamp = block.timestamp;
    times.push(parseInt(time.toString(), 10));
  }
  return Math.round(times.reduce((a, b) => a + b) / times.length);
}

export async function getClosestBlock<Net extends NetworkName>(
  web3: Web3On<Net>,
  initBlock: number,
  endingTimestamp: number,
): Promise<number> {
  let lastBlockNumber = (await web3.eth.getBlock('latest')).number;
  let startBlockNumber = initBlock;
  for (;;) {
    const middleBlockIncrement = Math.floor(
      (lastBlockNumber - startBlockNumber) / 2,
    );
    const candidateBlock = startBlockNumber + middleBlockIncrement;
    // eslint-disable-next-line no-await-in-loop
    const candidateTimestamp = await getBlockTimestamp(web3, candidateBlock);
    // eslint-disable-next-line no-await-in-loop
    const nextCandidateTimestamp = await getBlockTimestamp(
      web3,
      candidateBlock + 1,
    );
    if (
      candidateTimestamp <= endingTimestamp &&
      nextCandidateTimestamp > endingTimestamp
    ) {
      return candidateBlock;
    }
    if (
      candidateTimestamp <= endingTimestamp &&
      nextCandidateTimestamp <= endingTimestamp
    ) {
      startBlockNumber = candidateBlock;
    } else {
      lastBlockNumber = candidateBlock;
    }
  }
  throwError('Not found');
}
