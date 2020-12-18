import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import {
  SynthereumPool,
  SynthereumRealmWithWeb3,
} from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import {
  createEverLogger,
  ExchangeRequestService,
  MintRequestService,
  RedeemRequestService,
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
  exchangeService: ExchangeRequestService<Net>;
  redeemService: RedeemRequestService<Net>;
  mintService: MintRequestService<Net>;
  private logger = createEverLogger({
    name: 'validator',
  });
  constructor(
    private readonly realm: SynthereumRealmWithWeb3<Net>,
    { FREQUENCY, MAX_SLIPPAGE }: ENV,
  ) {
    this.frequency = FREQUENCY;
    this.maxSlippage = MAX_SLIPPAGE;
    this.exchangeService = new ExchangeRequestService(this.realm, {
      MAX_SLIPPAGE,
    } as ENV);
    this.redeemService = new RedeemRequestService({
      MAX_SLIPPAGE,
    } as ENV);
    this.mintService = new MintRequestService({
      MAX_SLIPPAGE,
    } as ENV);
  }

  get defaultAccount(): AddressOn<Net> {
    return this.realm.web3.defaultAccount as AddressOn<Net>;
  }

  start() {
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
        this.logger.error(error);
      }
    }
  }
}
