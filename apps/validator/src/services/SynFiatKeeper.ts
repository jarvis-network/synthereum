/* eslint-disable camelcase */
/* eslint-disable no-await-in-loop */
import { performance } from 'perf_hooks';

import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-contracts/dist/src/core/types/realm';
import { mapPools } from '@jarvis-network/synthereum-contracts/dist/src/core/pool-utils';
import { SynthereumPool } from '@jarvis-network/synthereum-contracts/dist/src/core/types/pools';
import {
  ExchangeRequestValidator,
  MintRequestValidator,
  PriceFeed,
  RedeemRequestValidator,
} from '@jarvis-network/validator-lib';
import { delay } from '@jarvis-network/web3-utils/base/async';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import Logger from 'bunyan';

import { assertNotNull } from '@jarvis-network/web3-utils/base/asserts';
import { NonPayableTransactionObject } from '@jarvis-network/web3-utils/eth/contracts/typechain/types';

import { ENV } from '../config';

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

  exchangeService: ExchangeRequestValidator;

  redeemService: RedeemRequestValidator;

  mintService: MintRequestValidator;

  priceFeed = new PriceFeed();

  constructor(
    private logger: Logger,
    private readonly realm: SynthereumRealmWithWeb3<Net>,
    { FREQUENCY, MAX_SLIPPAGE }: ENV,
  ) {
    this.frequency = FREQUENCY;
    this.maxSlippage = MAX_SLIPPAGE;
    const env = {
      MAX_SLIPPAGE,
    } as ENV;
    this.exchangeService = new ExchangeRequestValidator(
      this.priceFeed,
      this.realm,
      env,
    );
    this.redeemService = new RedeemRequestValidator(this.priceFeed, env);
    this.mintService = new MintRequestValidator(this.priceFeed, env);
  }

  get defaultAccount(): AddressOn<Net> {
    return this.realm.web3.defaultAccount as AddressOn<Net>;
  }

  async start(): Promise<void> {
    this.priceFeed.connect();
    this.logger.info('Synthereum - entering main polling loop');

    for (;;) {
      const started = performance.now();

      const all = await Promise.all(
        mapPools(this.realm, 'v1', pool => {
          this.logger.info(`Checking pool`, pool.symbol);
          return [
            this.checkMintRequests(pool),
            this.checkRedeemRequests(pool),
            this.checkExchangeRequests(pool),
          ];
        }).flat(),
      );

      this.logger.info(
        `Checked ${all.length} requests in ${
          (performance.now() - started) / 1000
        } second(s)`,
      );

      await delay(1000 * this.frequency);
    }
  }

  stop(): void {
    this.priceFeed.disconnect();
    clearInterval(assertNotNull(this.interval));
  }

  private async checkRequests<T extends [string, string, string, ...unknown[]]>(
    info: SynthereumPool<'v1', Net>,
    getRequestsMethod: () => NonPayableTransactionObject<T[]>,
    approveRequestMethod: ApproveRejectMethod,
    rejectRequestMethod: ApproveRejectMethod,
    type: 'mint' | 'redeem' | 'exchange', // Used for logging
    callback: (request: T) => Promise<boolean>,
  ) {
    const requests = await getRequestsMethod().call({
      from: this.defaultAccount,
    });

    this.logger.info(
      `Found ${requests.length} ${type} request(s) for ${info.symbol}`,
    );

    for (const request of requests) {
      const approve = await callback(request);

      await this.finishRequest(
        request[0],
        approve ? approveRequestMethod : rejectRequestMethod,
        `${approve ? 'Approved' : 'Rejected'} ${type}`,
      );
    }
  }

  private async checkMintRequests(info: SynthereumPool<'v1', Net>) {
    await this.checkRequests<MintOrRedeemRequest>(
      info,
      info.instance.methods.getMintRequests,
      info.instance.methods.approveMint,
      info.instance.methods.rejectMint,
      'mint',
      request =>
        this.mintService.CheckRequest(info, {
          mint_id: request[0],
          timestamp: request[1],
          sender: request[2],
          collateral_amount: request[3],
          num_tokens: request[4],
        }),
    );
  }

  private async checkRedeemRequests(info: SynthereumPool<'v1', Net>) {
    await this.checkRequests<MintOrRedeemRequest>(
      info,
      info.instance.methods.getRedeemRequests,
      info.instance.methods.approveRedeem,
      info.instance.methods.rejectRedeem,
      'redeem',
      request =>
        this.redeemService.CheckRequest(info, {
          redeem_id: request[0],
          timestamp: request[1],
          sender: request[2],
          collateral_amount: request[3],
          num_tokens: request[4],
        }),
    );
  }

  private async checkExchangeRequests(info: SynthereumPool<'v1', Net>) {
    await this.checkRequests<ExchangeRequest>(
      info,
      info.instance.methods.getExchangeRequests,
      info.instance.methods.approveExchange,
      info.instance.methods.rejectExchange,
      'exchange',
      request =>
        this.exchangeService.CheckRequest(info, {
          exchange_id: request[0],
          timestamp: request[1],
          sender: request[2],
          dest_tic: request[3],
          num_tokens: request[4],
          collateral_amount: request[5],
          dest_num_tokens: request[6],
        }),
    );
  }

  async finishRequest(
    requestId: string,
    resolveCallback: ApproveRejectMethod,
    resolveLabel: string,
  ): Promise<void> {
    try {
      const from = this.defaultAccount;
      const gasPrice = await this.realm.web3.eth.getGasPrice();
      this.logger.info(
        `[1/5]: Preparing to respond to request from=${from} gasPrice=${gasPrice}`,
      );
      const tx = resolveCallback(requestId);
      this.logger.info(`[2/5]: resolveCallback returned successfully`);
      const gas = await tx.estimateGas({ from });
      this.logger.info(`[3/5]: estimateGas returned gas=${gas}`);
      const transaction = await resolveCallback(requestId).send({
        from,
        gasPrice,
        gas,
      });
      this.logger.info(
        `[4/5]: resolveCallback returned txhash=${transaction.transactionHash}`,
      );
      // Wait for the transaction to be mined
      const receipt = await this.realm.web3.eth.getTransactionReceipt(
        transaction.transactionHash,
      );
      this.logger.info(
        `[5/5] getTransactionReceipt succeeded for ${resolveLabel} request ${requestId} in transaction ${transaction.transactionHash} - gas used: ${receipt.gasUsed}`,
      );
    } catch (error) {
      this.logger.error('Unable to finishRequest', error);
      if (error.message.includes('BlockNotFound')) {
        this.logger.warn(error);
      } else if (error.message.includes('ValueError')) {
        this.logger.warn(error);
        this.logger.warn(
          `Make sure there the LP has deposited enough the excess collateral required for the ${resolveLabel} request`,
        );
      } else {
        this.logger.error(error.stack);
      }
    }
  }
}
