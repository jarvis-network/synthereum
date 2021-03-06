import BN from 'bn.js';
import { SupportedNetworkName } from '@jarvis-network/synthereum-ts/dist/config';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-ts/dist/core/types/realm';
import { SynthereumPool } from '@jarvis-network/synthereum-ts/dist/core/types/pools';
import { scale } from '@jarvis-network/core-utils/dist/base/big-number';
import { assertIsAddress } from '@jarvis-network/core-utils/dist/eth/address';
import {
  getTokenAllowance,
  getTokenBalance,
  scaleTokenAmountToWei,
} from '@jarvis-network/core-utils/dist/eth/contracts/erc20';

import { PriceFeed } from '../api/jarvis-exchange-price-feed';
import { ENV } from '../config';
import { ExchangeRequest } from '../interfaces';
import { createEverLogger } from '../log';

export class ExchangeRequestValidator {
  private logger = createEverLogger({
    name: 'synthetic-contracts-exchange-request',
  });

  maxSlippage: number;

  constructor(
    private readonly priceFeed: PriceFeed,
    private readonly realm: SynthereumRealmWithWeb3<SupportedNetworkName>,
    { MAX_SLIPPAGE }: ENV,
  ) {
    this.maxSlippage = MAX_SLIPPAGE;
  }

  async CheckRequest(
    info: SynthereumPool<'v1', SupportedNetworkName>,
    request: ExchangeRequest,
  ): Promise<boolean> {
    const { priceFeed } = info;
    const requestTime = request.timestamp;
    const price = await this.priceFeed.getPrice(priceFeed, requestTime);
    if (!price) {
      throw new Error('Forex is closed');
    }
    this.logger.info(
      `${info.symbol} was ${price} for exchange request ${request.exchange_id}`,
    );

    const destTic = request.dest_tic;
    const destinationInfo = Object.values(this.realm.pools.v1!).find(
      pool => pool!.address === destTic,
    );
    if (!destinationInfo) {
      this.logger.warn(`No TIC configured for address ${request.dest_tic}`);
      return false;
    }

    const { priceFeed: destinationPriceFeed, symbol } = destinationInfo;
    const destPrice = await this.priceFeed.getPrice(
      destinationPriceFeed,
      requestTime,
    );

    if (!destPrice) {
      this.logger.info('Forex is closed');
      return false;
    }
    this.logger.info(
      `${symbol} was ${destPrice} for exchange request ${request.exchange_id}`,
    );

    const tokens = scaleTokenAmountToWei({
      amount: new BN(request.num_tokens[0]),
      decimals: info.syntheticToken.decimals,
    });
    const destTokens = scaleTokenAmountToWei({
      amount: new BN(request.dest_num_tokens[0]),
      decimals: info.syntheticToken.decimals,
    });

    if (
      scale(tokens, price) <
      scale(destTokens, destPrice * (1 - this.maxSlippage))
    ) {
      throw new Error(
        `Exchange request ${request.exchange_id} transfers too many destination tokens`,
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
        `Exchange request ${request.exchange_id} is not covered by user's ${info.symbol} balance ${balance} tokens ${tokens}`,
      );
    }
    if (allowance.lt(tokens)) {
      throw new Error(
        `Unable to approve exchange request ${request.exchange_id} until TIC is given an allowance ${allowance} to transfer the user's tokens ${tokens}`,
      );
    }
    return true;
  }
}
