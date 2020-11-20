import Web3 from "web3";
import { toBN } from "web3-utils";
import { isString, throwError } from "../base/asserts";

export async function getBlockTimestamp(
  web3: Web3,
  blockNumber: number,
): Promise<number> {
  const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp;
  return isString(timestamp) ? Number.parseInt(timestamp) : timestamp;
}

export async function getBlockAverageTime(
  web3: Web3,
  blockNumber: number,
  span: number,
): Promise<number> {
  const times = [];
  const firstBlock = await web3.eth.getBlock(blockNumber - span);
  let prevTimestamp = firstBlock.timestamp;
  for (let i = blockNumber - span + 1; i <= blockNumber; i++) {
    const block = await web3.eth.getBlock(i);
    let time = toBN(block.timestamp).sub(toBN(prevTimestamp));
    prevTimestamp = block.timestamp;
    times.push(parseInt(time.toString()));
  }
  return Math.round(times.reduce((a, b) => a + b) / times.length);
}

export async function getClosestBlock(
  web3: Web3,
  initBlock: number,
  endingTimestamp: number,
): Promise<number> {
  let lastBlockNumber = (await web3.eth.getBlock('latest')).number;
  let startBlockNumber = initBlock;
  while (1 === 1) {
    const middleBlockIncrement = Math.floor(
      (lastBlockNumber - startBlockNumber) / 2,
    );
    const candidateBlock = startBlockNumber + middleBlockIncrement;
    const candidateTimestamp = await getBlockTimestamp(web3, candidateBlock);
    const nextCandidateTimestamp = await getBlockTimestamp(
      web3,
      candidateBlock + 1,
    );
    if (
      candidateTimestamp <= endingTimestamp &&
      nextCandidateTimestamp > endingTimestamp
    ) {
      return candidateBlock;
    } else if (
      candidateTimestamp <= endingTimestamp &&
      nextCandidateTimestamp <= endingTimestamp
    ) {
      startBlockNumber = candidateBlock;
    } else {
      lastBlockNumber = candidateBlock;
    }
  }
  throwError("Not found");
}
