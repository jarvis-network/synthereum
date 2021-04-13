import BN from 'bn.js';
import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config';
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
import { MintRequest } from '../interfaces';
import { createEverLogger } from '../log';

export class MintRequestValidator {
  private logger = createEverLogger({
    name: 'synthetic-contracts-mint-request',
  });

  maxSlippage: number;

  constructor(private readonly priceFeed: PriceFeed, { MAX_SLIPPAGE }: ENV) {
    this.maxSlippage = MAX_SLIPPAGE;
  }

  async CheckRequest(
    info: SynthereumPool<'v1', SupportedNetworkName>,
    request: MintRequest,
  ): Promise<boolean> {
    const { priceFeed } = info;
    const requestTime = request.timestamp;
    const price = await this.priceFeed.getPrice(priceFeed, requestTime);
    if (!price) {
      throw new Error('Forex is closed');
    }
    this.logger.info(
      `${info.symbol} was ${price} for mint request ${request.mint_id}`,
    );
    const collateral = scaleTokenAmountToWei({
      amount: new BN(request.collateral_amount[0]),
      decimals: info.collateralToken.decimals,
    });
    const tokens = scaleTokenAmountToWei({
      amount: new BN(request.num_tokens[0]),
      decimals: info.syntheticToken.decimals,
    });
    this.logger.info(`Minting ${tokens} tokens with ${collateral} collateral`);
    if (collateral.lt(scale(tokens, price * (1 - this.maxSlippage)))) {
      throw new Error(`Mint request ${request.mint_id} is undercollateralized`);
    }
    const sender = assertIsAddress<SupportedNetworkName>(request.sender);
    const allowance = await getTokenAllowance(
      info.collateralToken,
      sender,
      info.address,
    );

    const balance = await getTokenBalance(info.collateralToken, sender);
    if (balance.lt(collateral)) {
      throw new Error(
        `Mint request ${request.mint_id} is not covered by user's collateral balance ${balance} collateral ${collateral}`,
      );
    }

    if (allowance.lt(collateral)) {
      throw new Error(
        `Unable to approve mint request ${request.mint_id} until TIC is given an allowance  ${allowance} to transfer the user's collateral ${collateral}`,
      );
    }
    return true;
  }
}
