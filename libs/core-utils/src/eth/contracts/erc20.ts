import BN from 'bn.js';

import type { EventData } from 'web3-eth-contract/types';

import { t } from '../../base/meta';
import { assert, throwError } from '../../base/asserts';
import { SortedArray } from '../../base/sorting';
import { Amount, formatAmount, maxUint256 } from '../../base/big-number';
import { AddressOn } from '../address';
import { NetworkName, Web3On } from '../web3-instance';

import { getBlockTimestamp } from '../block';

import { TokenInfo, TimestampedTransferEvent } from './types';
import { sendTx, FullTxOptions } from './send-tx';

/**
 * Gets the balance of `account` on an ERC20 token in units of `wei`.
 *
 * If the token has less than 18 decimals, the result is multiplied by 10 ** (18 - decimals).
 *
 * Example:
 *   1 USDC is stored internally as 1 000 000 (6 decimals). To result of
 *   converting that value Amount is: 1 000 000 * (10 ** (18 - decimals)) =
 *   1 000 000 * (10 ** 12) = 10 ** 18
 *
 * @param tokenInfo object containing the ERC20 contract instance and number of decimals
 * @param account the address of the account to get the balance of
 */
export async function getTokenBalance<Net extends NetworkName>(
  { instance, decimals }: TokenInfo<Net>,
  account: AddressOn<Net>,
): Promise<Amount> {
  const amount = await instance.methods.balanceOf(account).call();
  assert(
    decimals > 0 && decimals <= 18,
    `Unexpected number of decimals: ${decimals}`,
  );
  return scaleTokenAmountToWei({ amount: new BN(amount), decimals });
}

/**
 * Gets the balance of `account` on an ERC20 token in units of `wei`.
 *
 * If the token has less than 18 decimals, the result is multiplied by 10 ** (18 - decimals).
 *
 * Example:
 *   1 USDC is stored internally as 1 000 000 (6 decimals). To result of
 *   converting that value Amount is: 1 000 000 * (10 ** (18 - decimals)) =
 *   1 000 000 * (10 ** 12) = 10 ** 18
 *
 * @param tokenInfo object containing the ERC20 contract instance and number of decimals
 * @param account the address of the account to get the balance of
 */
export async function getTokenAllowance<Net extends NetworkName>(
  { instance, decimals }: TokenInfo<Net>,
  account: AddressOn<Net>,
  spender: AddressOn<Net>,
): Promise<Amount> {
  const amount = await instance.methods.allowance(account, spender).call();
  return scaleTokenAmountToWei({ amount: new BN(amount), decimals });
}

export async function erc20Transfer<Net extends NetworkName>(
  info: TokenInfo<Net>,
  recipient: AddressOn<Net>,
  amount: Amount,
  txOptions: FullTxOptions<Net>,
) {
  const { symbol, decimals, instance } = info;
  const { from: sender } = txOptions;
  const balance = await getTokenBalance(info, sender);
  if (balance.lt(amount))
    throwError(
      `Insufficient balance of '${sender}': have '${formatAmount(balance)}' ` +
        `${symbol}, needs '${formatAmount(amount)}' ${symbol}`,
    );
  const tokens = weiToTokenAmount({ wei: amount, decimals });
  const tx = instance.methods.transfer(recipient, tokens.toString(10));
  return sendTx(tx, txOptions);
}

export function setTokenAllowance<Net extends NetworkName>(
  { instance, decimals }: TokenInfo<Net>,
  spender: AddressOn<Net>,
  allowance: Amount,
) {
  const amount = weiToTokenAmount({ wei: allowance, decimals });
  return instance.methods.approve(spender, amount.toString(10));
}

export function setMaxTokenAllowance<Net extends NetworkName>(
  info: TokenInfo<Net>,
  spender: AddressOn<Net>,
) {
  return setTokenAllowance(info, spender, maxUint256 as Amount);
}

type TokenAmountToWeiParams = {
  amount: BN;
  decimals: number;
};

export function scaleTokenAmountToWei({
  amount,
  decimals,
}: TokenAmountToWeiParams) {
  assert(
    decimals > 0 && decimals <= 18,
    `Unexpected number of decimals: ${decimals}`,
  );
  const scaleFactor = new BN(10).pow(new BN(18 - decimals));
  return new BN(amount).mul(scaleFactor) as Amount;
}

type WeiToTokenAmountParams = {
  wei: Amount;
  decimals: number;
};

export function weiToTokenAmount({
  wei,
  decimals,
}: WeiToTokenAmountParams): BN {
  const scaleFactor = new BN(10).pow(new BN(18 - decimals));
  return wei.div(scaleFactor);
}

export function getAllTransferEvents<Net extends NetworkName>(
  { instance }: TokenInfo<Net>,
  address?: string,
  fromBlock = 0,
  toBlock: number | 'latest' = 'latest',
): Promise<EventData[]> {
  return instance.getPastEvents('Transfer', {
    address,
    fromBlock,
    toBlock,
  });
}

export async function getAllTransferTransactions<Net extends NetworkName>(
  web3: Web3On<Net>,
  contract: TokenInfo<Net>,
  address?: string,
  fromBlock = 0,
  toBlock: number | 'latest' = 'latest',
) {
  const events = await getAllTransferEvents(
    contract,
    address,
    fromBlock,
    toBlock,
  );

  const txs = await Promise.all(
    events.map(async ({ transactionHash }) =>
      t(transactionHash, await web3.eth.getTransaction(transactionHash)),
    ),
  );

  const sorted = SortedArray.createFromUnsorted(
    txs,
    (a, b) => a[0].localeCompare(b[0]),
    tx => tx[0],
  );

  return sorted.uniq().array;
}

export async function getAllTransferInfo<Net extends NetworkName>(
  web3: Web3On<Net>,
  contract: TokenInfo<Net>,
  address?: string,
  fromBlock = 0,
  toBlock: number | 'latest' = 'latest',
) {
  const events = await getAllTransferEvents(
    contract,
    address,
    fromBlock,
    toBlock,
  );

  const eventsWithTimestamp: TimestampedTransferEvent[] = [];

  for (const { transactionHash, returnValues } of events) {
    // FIXME
    // eslint-disable-next-line no-await-in-loop
    const { blockNumber } = await web3.eth.getTransaction(transactionHash);

    if (!blockNumber) {
      continue;
    }

    // FIXME
    // eslint-disable-next-line no-await-in-loop
    const blockTimestamp = await getBlockTimestamp(web3, blockNumber);

    eventsWithTimestamp.push({
      from: returnValues.from,
      to: returnValues.to,
      value: returnValues.value,
      blockNumber,
      blockTimestamp,
    });
  }

  const sorted = SortedArray.createFromSortedUnsafe(
    eventsWithTimestamp,
    (a, b) => a.blockTimestamp - b.blockTimestamp,
    tx => tx.blockTimestamp,
  );

  return sorted;
}
