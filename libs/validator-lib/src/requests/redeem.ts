import BN from 'bn.js';
import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { SynthereumPool } from '@jarvis-network/synthereum-contracts/dist/src/core/types/pools';
import { scale } from '@jarvis-network/core-utils/dist/base/big-number';
import { assertIsAddress } from '@jarvis-network/core-utils/dist/eth/address';
import {
  getTokenAllowance,
  getTokenBalance,
  scaleTokenAmountToWei,
} from '@jarvis-network/core-utils/dist/eth/contracts/erc20';

import { PriceFeed } from '../api/jarvis-exchange-price-feed';
import { ENV } from '../config';
import { RedeemRequest } from '../interfaces';
import { createEverLogger } from '../log';

export class RedeemRequestValidator {
  private logger = createEverLogger({
    name: 'synthetic-contracts-redeem-request',
  });

  maxSlippage: number;

  constructor(private readonly priceFeed: PriceFeed, { MAX_SLIPPAGE }: ENV) {
    this.maxSlippage = MAX_SLIPPAGE;
  }

  async CheckRequest(
    info: SynthereumPool<'v1', SupportedNetworkName>,
    request: RedeemRequest,
  ): Promise<boolean> {
    const { priceFeed } = info;
    const requestTime = request.timestamp;
    const price = await this.priceFeed.getPrice(priceFeed, requestTime);
    if (!price) {
      throw new Error('Forex is closed');
    }
    this.logger.info(
      `${info.symbol} was ${price} for redeem request ${request.redeem_id}`,
    );
    const collateral = scaleTokenAmountToWei({
      amount: new BN(request.collateral_amount[0]),
      decimals: info.collateralToken.decimals,
    });
    const tokens = scaleTokenAmountToWei({
      amount: new BN(request.num_tokens[0]),
      decimals: info.syntheticToken.decimals,
    });
    this.logger.info(
      `Redeeming ${tokens} tokens with ${collateral} collateral`,
    );
    if (collateral.lt(scale(tokens, price * (1 - this.maxSlippage)))) {
      throw new Error(
        `Redeem request ${request.redeem_id} is undercollateralized`,
      );
    }
    const sender = assertIsAddress<SupportedNetworkName>(request.sender);
    const allowance = await getTokenAllowance(
      info.syntheticToken,
      sender,
      info.address,
    );
    const balance = await getTokenBalance(info.syntheticToken, sender);
    if (balance.lt(tokens)) {
      throw new Error(
        `Redeem request ${request.redeem_id} is not covered by user's ${info.symbol} balance ${balance} tokens ${tokens}`,
      );
    }

    if (allowance.lt(tokens)) {
      throw new Error(
        `Unable to approve redeem request ${request.redeem_id} until TIC is given an allowance ${allowance} to transfer the user's collateral ${tokens}`,
      );
    }
    return true;
  }
}
