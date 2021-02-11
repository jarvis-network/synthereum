import { getEthUsdBtcPrice } from '../../apis/etherscan';
import { parseFiniteFloat } from '../../base/asserts';
import { formatAmount, wei } from '../../base/big-number';
import { getBlockTimestamp } from '../block';
import type { NetworkName, Web3On } from '../web3-instance';

export interface PrintTxInfo {
  web3: Web3On<NetworkName>;
  txhash: string;
  contractName?: string;
  contractAddress?: string;
  contractInteraction?: string;
}

export async function printTruffleLikeTransactionOutput({
  web3,
  txhash,
  contractAddress,
  contractInteraction = 'Deploying',
  contractName,
}: PrintTxInfo) {
  if (!web3) return;
  const { gasPrice, gas: gasLimit, value } = await web3.eth.getTransaction(
    txhash,
  );
  const { blockNumber, from, gasUsed } = await web3.eth.getTransactionReceipt(
    txhash,
  );

  const accountBalance = wei(await web3.eth.getBalance(from));
  const timestamp = await getBlockTimestamp(web3, blockNumber);
  const gasUsedRatio = ((gasUsed / gasLimit) * 100).toFixed(2);
  const ethSent = parseFloat(value);
  const totalCost = (ethSent + gasUsed * parseFloat(gasPrice)) * 1e-18;
  const totalCostUsd = (
    totalCost * parseFiniteFloat((await getEthUsdBtcPrice()).ethusd)
  ).toFixed(2);

  return `${contractInteraction} '${contractName}'
   -------------------------------
   > transaction hash:    ${txhash}
   > contract address:    ${contractAddress}
   > block number:        ${blockNumber}
   > block timestamp:     ${timestamp} (${new Date(timestamp * 1000)})
   > account:             ${from}
   > balance:             ${formatAmount(accountBalance)}
   > gas used:            ${gasUsed} / ${gasLimit} (${gasUsedRatio}%)
   > gas price:           ${parseFloat(gasPrice) * 1e-9} gwei
   > value sent:          ${ethSent * 1e-18} ETH
   > total cost:          ${totalCost} ETH / ${totalCostUsd} USD`;
}
