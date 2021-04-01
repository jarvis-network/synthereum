import { getContractSourceCode, getEthUsdBtcPrice } from '../../apis/etherscan';
import { parseFiniteFloat } from '../../base/asserts';
import { nullOnFailure } from '../../base/async';
import { formatAmount, wei } from '../../base/big-number';
import type { AddressOn } from '../address';
import { getBlockTimestamp } from '../block';
import type { NetworkName, Web3On } from '../web3-instance';

export interface TxLogParams {
  txhash: string;
  txSummaryText?: string;
  contractName?: string;
  contractAddress?: AddressOn<NetworkName>;
  getContractNameFromEtherscan?: boolean;
  log?: (msg: string, ...args: any[]) => void;
}

export interface FullTxLogParams extends TxLogParams {
  web3: Web3On<NetworkName>;
}

export async function logTransactionOutput({
  log,
  web3,
  txhash,
  txSummaryText = 'Deploying',
  contractName,
  contractAddress,
  getContractNameFromEtherscan,
}: FullTxLogParams) {
  if (!log || !web3) return;

  const { gasPrice, gas, value } = await web3.eth.getTransaction(txhash);
  const {
    blockNumber,
    from,
    to,
    gasUsed,
  } = await web3.eth.getTransactionReceipt(txhash);

  contractName ??=
    getContractNameFromEtherscan === true && contractAddress
      ? (await nullOnFailure(getContractSourceCode(contractAddress)))
          ?.ContractName
      : undefined;

  const accountBalance = wei(await web3.eth.getBalance(from));
  const timestamp = await getBlockTimestamp(web3, blockNumber);
  const gasUsedRatio = ((gasUsed / gas) * 100).toFixed(2);
  const ethSent = parseFloat(value);
  const totalCost = (ethSent + gasUsed * parseFloat(gasPrice)) * 1e-18;
  const ethUsdRate = (await nullOnFailure(getEthUsdBtcPrice()))?.ethusd;
  const totalCostUsd = ethUsdRate
    ? ` / ${(totalCost * parseFiniteFloat(ethUsdRate)).toFixed(2)} USD`
    : '';

  log(`${txSummaryText}${!contractName ? '' : ` '${contractName}'`}
   -------------------------------
   > transaction hash:    ${txhash}
   > contract address:    ${to}
   > block number:        ${blockNumber}
   > block timestamp:     ${timestamp} (${new Date(timestamp * 1000)})
   > account:             ${from}
   > balance:             ${formatAmount(accountBalance)}
   > gas used:            ${gasUsed} / ${gas} (${gasUsedRatio}%)
   > gas price:           ${parseFloat(gasPrice) * 1e-9} gwei
   > value sent:          ${ethSent * 1e-18} ETH
   > total cost:          ${totalCost} ETH${totalCostUsd}`);
}
