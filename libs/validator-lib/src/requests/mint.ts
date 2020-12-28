import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { SynthereumPool } from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import { scale } from '@jarvis-network/web3-utils/base/big-number';
import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';
import {
  getTokenAllowance,
  getTokenBalance,
  scaleTokenAmountToWei,
} from '@jarvis-network/web3-utils/eth/contracts/erc20';
import { PriceFeed } from '../api/jarvis_exchange_price_feed';
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
    info: SynthereumPool<SupportedNetworkName>,
    request: MintRequest,
  ): Promise<boolean> {
    const { priceFeed } = info;
    const requestTime = request.timestamp;
    const price = await this.priceFeed.getPrice(priceFeed, requestTime);
    if (price) {
      this.logger.info(
        `${info.symbol} was ${price} for mint request ${request.mint_id}`,
      );
      const collateral = scaleTokenAmountToWei({
        amount: request.collateral_amount[0],
        decimals: info.collateralToken.decimals,
      });
      const tokens = scaleTokenAmountToWei({
        amount: request.num_tokens[0],
        decimals: info.syntheticToken.decimals,
      });
      this.logger.info(
        `Minting ${tokens} tokens with ${collateral} collateral`,
      );
      if (collateral.lt(scale(tokens, price * (1 - this.maxSlippage)))) {
        this.logger.info(
          `Mint request ${request.mint_id} is undercollateralized`,
        );
        return false;
      }
      const sender = assertIsAddress<SupportedNetworkName>(request.sender);
      const allowance = await getTokenAllowance(
        info.collateralToken,
        sender,
        info.address,
      );
      const balance = await getTokenBalance(info.collateralToken, sender);
      if (balance < collateral) {
        this.logger.info(
          `Mint request ${request.mint_id} is not covered by user's collateral balance`,
        );
        return false;
      }

      if (allowance < collateral) {
        this.logger.info(
          `Unable to approve mint request ${request.mint_id} until TIC is given an allowance to transfer the user's collateral`,
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
