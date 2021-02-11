import { getEthUsdBtcPrice } from '@jarvis-network/web3-utils/apis/etherscan';
import { parseFiniteFloat } from '@jarvis-network/web3-utils/base/asserts';
import { formatAmount, wei } from '@jarvis-network/web3-utils/base/big-number';
import { getBlockTimestamp } from '@jarvis-network/web3-utils/eth/block';
import type { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import type { SupportedNetworkName } from '../config';

interface TxAdditionalInfo {
  contractName?: string;
  contractAddress?: string;
  contractInteraction?: string;
}

export async function printTruffleLikeTransactionOutput<
  Net extends SupportedNetworkName = SupportedNetworkName
>(
  web3: Web3On<Net>,
  txhash: string,
  {
    contractAddress,
    contractInteraction = 'Deploying',
    contractName,
  }: TxAdditionalInfo,
) {
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
