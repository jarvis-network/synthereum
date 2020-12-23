import { Logger } from '../logger';
import * as bunyan from 'bunyan';
import { performance } from 'perf_hooks';
import type { ENV } from '../config';
import { NonPayableTransactionObject } from '@jarvis-network/web3-utils';

import { scale } from '@jarvis-network/web3-utils/base/big-number';
import { getPriceFeedOhlc } from '../api/jarvis_market_price_feed';
import { base } from '@jarvis-network/web3-utils';
import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import {
  SynthereumPool,
  SynthereumRealmWithWeb3,
} from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import {
  AddressOn,
  assertIsAddress,
} from '@jarvis-network/web3-utils/eth/address';
import {
  getTokenAllowance,
  getTokenBalance,
  scaleTokenAmountToWei,
} from '@jarvis-network/web3-utils/eth/contracts/erc20';

type ApproveRejectMethod = (
  id: string | number[],
) => NonPayableTransactionObject<void>;
type MintOrRedeemRequest = [string, string, string, [string], [string]];
type ExchangeRequest = [
  string,
  string,
  string,
  string,
  [string],
  [string],
  [string],
];
export default class SynFiatKeeper<Net extends SupportedNetworkName> {
  interval?: ReturnType<typeof setInterval>;
  maxSlippage: number;
  frequency: number;

  constructor(
    private readonly realm: SynthereumRealmWithWeb3<Net>,
    { FREQUENCY, MAX_SLIPPAGE }: ENV,
    private readonly logger: bunyan = Logger('KeeperBot', 'logging', 'info'),
  ) {
    this.frequency = FREQUENCY;
    this.maxSlippage = MAX_SLIPPAGE;
  }

  get defaultAccount(): AddressOn<Net> {
    return this.realm.web3.defaultAccount as AddressOn<Net>;
  }

  start() {
    this.logger.info('Synthereum - setting up timers');
    this.interval = setInterval(() => {
      let started: number = performance.now();

      Promise.all(
        Object.values(this.realm.ticInstances).map(info =>
          Promise.all([
            this.checkMintRequests(info),
            this.checkRedeemRequests(info),
            this.checkExchangeRequests(info),
          ]),
        ),
      ).then(() => {
        this.logger.info(
          `Checked requests in ${
            (performance.now() - started) / 1000
          } second(s)`,
        );
      });
    }, 1000 * this.frequency);
  }

  stop() {
    clearInterval(base.asserts.assertNotNull(this.interval));
  }

  private async checkRequests<T extends [string, string, string, ...unknown[]]>(
    info: SynthereumPool<Net>,
    getRequestsMethod: () => NonPayableTransactionObject<T[]>,
    approveRequestMethod: ApproveRejectMethod,
    rejectRequestMethod: ApproveRejectMethod,
    type: 'mint' | 'redeem' | 'exchange', // Used for logging
    callback: (
      request: T,
      price: number,
      requestTime: string,
    ) => Promise<boolean>,
  ) {
    const requests = await getRequestsMethod().call({
      from: this.defaultAccount,
    });

    this.logger.info(
      `Found ${requests.length} ${type} request(s) for ${info.symbol}`,
    );

    for (const request of requests) {
      const { priceFeed } = info;
      const requestTime = request[1];
      const price = await getPriceFeedOhlc(priceFeed, requestTime);

      if (!price) {
        this.logger.info('Forex is closed');
        continue;
      }

      this.logger.info(
        `${info.symbol} was ${price} for ${type} request ${request[0]}`,
      );

      const approve = await callback(request, price, requestTime);

      await this.finishRequest(
        request[0],
        approve ? approveRequestMethod : rejectRequestMethod,
        `${approve ? 'Approved' : 'Rejected'} ${type}`,
      );
    }
  }

  private async checkMintRequests(info: SynthereumPool<Net>) {
    await this.checkRequests<MintOrRedeemRequest>(
      info,
      info.instance.methods.getMintRequests,
      info.instance.methods.approveMint,
      info.instance.methods.rejectMint,
      'mint',
      async (request, price) => {
        const collateral = scaleTokenAmountToWei({
          amount: request[3][0],
          decimals: info.collateralToken.decimals,
        });
        const tokens = scaleTokenAmountToWei({
          amount: request[4][0],
          decimals: info.syntheticToken.decimals,
        });
        // const tokens = parseTokens(request[4][0], info.syntheticToken.decimals);

        this.logger.info(
          `Minting ${tokens} tokens with ${collateral} collateral`,
        );

        if (collateral.lt(scale(tokens, price * (1 - this.maxSlippage)))) {
          this.logger.info(`Mint request ${request[0]} is undercollateralized`);
          return false;
        }

        const sender = assertIsAddress<Net>(request[2]);
        const allowance = await getTokenAllowance(
          info.collateralToken,
          sender,
          info.address,
        );
        const balance = await getTokenBalance(info.collateralToken, sender);

        if (balance < collateral) {
          this.logger.info(
            `Mint request ${request[0]} is not covered by user's collateral balance`,
          );
          return false;
        }

        if (allowance < collateral) {
          this.logger.info(
            `Unable to approve mint request ${request[0]} until TIC is given an allowance to transfer the user's collateral`,
          );

          return false;
        }

        return true;
      },
    );
  }

  private async checkRedeemRequests(info: SynthereumPool<Net>) {
    await this.checkRequests<MintOrRedeemRequest>(
      info,
      info.instance.methods.getRedeemRequests,
      info.instance.methods.approveRedeem,
      info.instance.methods.rejectRedeem,
      'redeem',
      async (request, price) => {
        const collateral = scaleTokenAmountToWei({
          amount: request[3][0],
          decimals: info.collateralToken.decimals,
        });
        const tokens = scaleTokenAmountToWei({
          amount: request[4][0],
          decimals: info.syntheticToken.decimals,
        });

        this.logger.info(
          `Redeeming ${tokens} tokens with ${collateral} collateral`,
        );

        if (collateral > scale(tokens, price * (1 + this.maxSlippage))) {
          this.logger.info(
            `Redeem request ${request[0]} is undercollateralized`,
          );
          return false;
        }

        const sender = assertIsAddress<Net>(request[2]);
        const allowance = await getTokenAllowance(
          info.syntheticToken,
          sender,
          info.address,
        );
        const balance = await getTokenBalance(info.syntheticToken, sender);

        if (balance.lt(tokens)) {
          this.logger.info(
            `Redeem request ${request[0]} is not covered by user's ${info.symbol} balance`,
          );
          return false;
        }

        if (allowance.lt(tokens)) {
          this.logger.info(
            `Unable to approve redeem request ${request[0]} until TIC is given an allowance to transfer the user's collateral`,
          );
          return false;
        }

        return true;
      },
    );
  }

  private async checkExchangeRequests(info: SynthereumPool<Net>) {
    await this.checkRequests<ExchangeRequest>(
      info,
      info.instance.methods.getExchangeRequests,
      info.instance.methods.approveExchange,
      info.instance.methods.rejectExchange,
      'exchange',
      async (request, price, requestTime) => {
        const destTic = request[3];
        const destinationInfo = Object.values(this.realm.ticInstances).find(
          pool => pool.address === destTic,
        );
        if (!destinationInfo) {
          this.logger.warn(`No TIC configured for address ${destTic}`);
          return false;
        }

        const { priceFeed: destinationPriceFeed, symbol } = destinationInfo;
        const destPrice = await getPriceFeedOhlc(
          destinationPriceFeed,
          requestTime,
        );

        if (!destPrice) {
          this.logger.info('Forex is closed');
          return false;
        }

        this.logger.info(
          `${symbol} was ${destPrice} for exchange request ${request[0]}`,
        );

        const tokens = scaleTokenAmountToWei({
          amount: request[4][0],
          decimals: info.syntheticToken.decimals,
        });
        const destTokens = scaleTokenAmountToWei({
          amount: request[5][0],
          decimals: info.syntheticToken.decimals,
        });

        if (
          scale(tokens, price) <
          scale(destTokens, destPrice * (1 - this.maxSlippage))
        ) {
          this.logger.info(
            `Exchange request ${request[0]} transfers too many destination tokens`,
          );
          return false;
        }

        const sender = assertIsAddress<Net>(request[2]);
        const allowance = await getTokenAllowance(
          info.syntheticToken,
          sender,
          info.address,
        );
        const balance = await getTokenBalance(info.syntheticToken, sender);

        if (balance < tokens) {
          this.logger.info(
            `Exchange request ${request[0]} is not covered by user's ${info.symbol} balance`,
          );
          return false;
        }

        if (allowance < tokens) {
          this.logger.info(
            `Unable to approve exchange request ${request[0]} until TIC is given an allowance to transfer the user's tokens`,
          );
          return false;
        }

        return true;
      },
    );
  }

  async finishRequest(
    requestId: string,
    resolveCallback: ApproveRejectMethod,
    resolveLabel: string,
  ) {
    try {
      const from = this.defaultAccount;

      const gasPrice = await this.realm.web3.eth.getGasPrice();
      const gas = await resolveCallback(requestId).estimateGas({ from });

      const transaction = await resolveCallback(requestId).send({
        from,
        gasPrice,
        gas,
      });
      // Wait for the transaction to be mined
      const receipt = await this.realm.web3.eth.getTransactionReceipt(
        transaction.transactionHash,
      );

      this.logger.info(
        `${resolveLabel} request ${requestId} in transaction ${transaction.transactionHash}`,
      );
    } catch (error) {
      if (error.message.includes('BlockNotFound')) {
        this.logger.warn(error);
      } else if (error.message.includes('ValueError')) {
        this.logger.warn(error);
        this.logger.warn(
          `Make sure there the LP has deposited enough the excess collateral required for the ${resolveLabel} request`,
        );
      } else {
        this.logger.error(error.message);
        this.logger.error(error.stack);
      }
    }
  }
}
