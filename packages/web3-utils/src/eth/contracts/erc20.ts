import BN from 'bn.js';
import { sorting } from '../../base';
import { assert } from '../../base/asserts';
import { Amount, maxUint256 } from '../../base/big-number';
import { AddressOn } from '../address';
import { NetworkName } from '../web3-instance';
import { TokenInfo } from './types';

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
  return scaleTokenAmountToWei({ amount, decimals });
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
  return scaleTokenAmountToWei({ amount, decimals });
}

export async function setTokenAllowance<Net extends NetworkName>(
  { instance, decimals }: TokenInfo<Net>,
  spender: AddressOn<Net>,
  allowance: Amount
) {
  const amount = weiToTokenAmount({ wei: allowance, decimals });
  return await instance.methods.approve(spender, amount).call();
}

export async function setMaxTokenAllowance<Net extends NetworkName>(
  info: TokenInfo<Net>,
  spender: AddressOn<Net>,
) {
  return await setTokenAllowance(info, spender, maxUint256 as Amount);
}

type TokenAmountToWeiParams = {
  amount: string;
  decimals: number;
};

function scaleTokenAmountToWei({ amount, decimals }: TokenAmountToWeiParams) {
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

function weiToTokenAmount({ wei, decimals }: WeiToTokenAmountParams): string {
  const scaleFactor = new BN(10).pow(new BN(18 - decimals));
  return wei.div(scaleFactor).toString();
}
