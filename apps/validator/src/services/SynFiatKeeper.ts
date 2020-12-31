import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import {
  SynthereumPool,
  SynthereumRealmWithWeb3,
} from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import {
  createEverLogger,
  ExchangeRequestValidator,
  MintRequestValidator,
  PriceFeed,
  RedeemRequestValidator,
} from '@jarvis-network/validator-lib';
import { base, NonPayableTransactionObject } from '@jarvis-network/web3-utils';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { performance } from 'perf_hooks';
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
  private logger = createEverLogger({
    name: 'validator',
  });
  constructor(
    private readonly realm: SynthereumRealmWithWeb3<Net>,
    { FREQUENCY, MAX_SLIPPAGE }: ENV,
  ) {
    this.frequency = FREQUENCY;
    this.maxSlippage = MAX_SLIPPAGE;
    const _env = {
      MAX_SLIPPAGE,
    } as ENV;
    this.exchangeService = new ExchangeRequestValidator(
      this.priceFeed,
      this.realm,
      _env,
    );
    this.redeemService = new RedeemRequestValidator(this.priceFeed, _env);
    this.mintService = new MintRequestValidator(this.priceFeed, _env);
  }

  get defaultAccount(): AddressOn<Net> {
    return this.realm.web3.defaultAccount as AddressOn<Net>;
  }

  start() {
    this.priceFeed.connect();
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
    this.priceFeed.disconnect();
    clearInterval(base.asserts.assertNotNull(this.interval));
  }

  private async checkRequests<T extends [string, string, string, ...unknown[]]>(
    info: SynthereumPool<Net>,
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

  private async checkMintRequests(info: SynthereumPool<Net>) {
    await this.checkRequests<MintOrRedeemRequest>(
      info,
      info.instance.methods.getMintRequests,
      info.instance.methods.approveMint,
      info.instance.methods.rejectMint,
      'mint',
      async request => {
        return this.mintService.CheckRequest(info, {
          mint_id: request[0],
          timestamp: request[1],
          sender: request[2],
          collateral_amount: request[3],
          num_tokens: request[4],
        });
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
      async request => {
        return this.redeemService.CheckRequest(info, {
          redeem_id: request[0],
          timestamp: request[1],
          sender: request[2],
          collateral_amount: request[3],
          num_tokens: request[4],
        });
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
      async request => {
        return this.exchangeService.CheckRequest(info, {
          exchange_id: request[0],
          timestamp: request[1],
          sender: request[2],
          dest_tic: request[3],
          num_tokens: request[4],
          collateral_amount: request[5],
          dest_num_tokens: request[6],
        });
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
        `[5/5] getTransactionReceipt succeeded for ${resolveLabel} request ${requestId} in transaction ${transaction.transactionHash}`,
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
