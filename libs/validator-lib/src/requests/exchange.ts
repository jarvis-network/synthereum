import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config';
import {
  SynthereumPool,
  SynthereumRealmWithWeb3,
} from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import { scale } from '@jarvis-network/web3-utils/base/big-number';
import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';
import {
  getTokenAllowance,
  getTokenBalance,
  scaleTokenAmountToWei,
} from '@jarvis-network/web3-utils/eth/contracts/erc20';
import { PriceFeed } from '../api/jarvis_exchange_price_feed';
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
    info: SynthereumPool<SupportedNetworkName>,
    request: ExchangeRequest,
  ): Promise<boolean> {
    const { priceFeed } = info;
    const requestTime = request.timestamp;
    const price = await this.priceFeed.getPrice(priceFeed, requestTime);
    if (price) {
      this.logger.info(
        `${info.symbol} was ${price} for exchange request ${request.exchange_id}`,
      );

      const destTic = request.dest_tic;
      const destinationInfo = Object.values(this.realm.ticInstances).find(
        pool => pool.address === destTic,
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
        amount: request.num_tokens[0],
        decimals: info.syntheticToken.decimals,
      });
      const destTokens = scaleTokenAmountToWei({
        amount: request.dest_num_tokens[0],
        decimals: info.syntheticToken.decimals,
      });

      if (
        scale(tokens, price) <
        scale(destTokens, destPrice * (1 - this.maxSlippage))
      ) {
        this.logger.info(
          `Exchange request ${request.exchange_id} transfers too many destination tokens`,
        );
        return false;
      }
      const sender = assertIsAddress<SupportedNetworkName>(request.sender);
      const allowance = await getTokenAllowance(
        info.syntheticToken,
        sender,
        info.address,
      );
      const balance = await getTokenBalance(info.syntheticToken, sender);

      if (balance < tokens) {
        this.logger.info(
          `Exchange request ${request.exchange_id} is not covered by user's ${info.symbol} balance`,
        );
        return false;
      }
      if (allowance < tokens) {
        this.logger.info(
          `Unable to approve exchange request ${request.exchange_id} until TIC is given an allowance to transfer the user's tokens`,
        );
        return false;
      }
      return true;
    } else {
      this.logger.info('Forex is closed');
    }
    return false;
  }
}
