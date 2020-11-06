import { Logger } from '../logger';
import * as bunyan from 'bunyan';
import { performance } from 'perf_hooks';
import { Contract, CallOptions } from 'web3-eth-contract';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import type { ENV } from '../config';
import { Web3Service } from '@jarvis/web3-utils';

interface GenericContract<T = {}> extends Contract {
  methods: T;
}

type ContractMethod<
  CallPromiseResolveType = void,
  Parameters extends unknown[] = []
> = (
  ...args: Parameters
) => { call(arg?: CallOptions): Promise<CallPromiseResolveType> };

type Request = [string, number, string];
type Concat<T extends unknown[], I extends unknown[]> = [...T, ...I];
type ExtendsRequest = Concat<Request, [...unknown[]]>;
type MintOrRedeemRequest = Concat<Request, [[number], [number]]>;
type ExchangeRequest = Concat<Request, [string, [number], [number]]>;

type OHLC = {
  c: [number] | [];
};

type TIC = GenericContract<{
  getMintRequests: ContractMethod<MintOrRedeemRequest[]>;
  getRedeemRequests: ContractMethod<MintOrRedeemRequest[]>;
  getExchangeRequests: ContractMethod<ExchangeRequest[]>;
  collateralToken: ContractMethod;
  approveMint: ContractMethod<string, [string]>;
  rejectMint: ContractMethod<string, [string]>;
  approveRedeem: ContractMethod<string, [string]>;
  rejectRedeem: ContractMethod<string, [string]>;
  approveExchange: ContractMethod<string, [string]>;
  rejectExchange: ContractMethod<string, [string]>;
}>;

type CollateralTokenContract = GenericContract<{
  allowance: ContractMethod<number, [string, string]>;
  balanceOf: ContractMethod<number, [string]>;
}>;

type SyntheticTokenContract = GenericContract<{
  allowance: ContractMethod<number, [string, string]>;

  balanceOf: ContractMethod<number, [string]>;
}>;

interface SyntheticInfo {
  symbol: string;
  priceFeed: string;
  ticAddress: string;
  tic: TIC;
  collateralTokenAddress: string;
  collateralToken: CollateralTokenContract;
  syntheticTokenAddress: string;
  syntheticToken: SyntheticTokenContract;
}

export default class SynFiatKeeper {
  interval?: ReturnType<typeof setInterval>;
  maxSlippage: number;
  syntheticInfos: SyntheticInfo[] = [];
  frequency: number;

  constructor(
    private web3: Web3Service,
    env: ENV,
    private logger: bunyan = Logger('KeeperBot', 'logging', 'info'),
  ) {
    this.frequency = Number.parseInt(env.FREQUENCY);
    this.maxSlippage = Number.parseFloat(env.MAX_SLIPPAGE);
  }

  async loadContracts() {
    const ticConfig: {
      factory_address: string;
      synthetics: {
        symbol: string;
        price_feed: string;
      }[];
    } = JSON.parse(
      fs
        .readFileSync(path.resolve(__dirname, '..', '..', 'config', 'tic.json'))
        .toString(),
    );

    // 1) Obtain TICFactory instace
    let factory = await this.getContract(
      ticConfig.factory_address,
      'TICFactory',
    );

    this.syntheticInfos = await Promise.all(
      ticConfig.synthetics.map(async ({ symbol, price_feed: priceFeed }) => {
        // 2) Get TIC instance for jEUR
        let ticAddress = await factory.methods.symbolToTIC(symbol).call();
        // const tic: TIC = await this.getContract(ticAddress, 'TIC');
        const tic = await this.getContract(ticAddress, 'TIC');
        // 3) Get the collateral token for jEUR:
        const collateralTokenAddress = await tic.methods
          .collateralToken()
          .call();

        const collateralToken = await this.getContract(
          collateralTokenAddress,
          'IERC20',
        );
        // 4) Get actual synthetic token jEUR:
        const syntheticTokenAddress = await tic.methods.syntheticToken().call();

        const syntheticToken = await this.getContract(
          syntheticTokenAddress,
          'IERC20',
        );

        const info: SyntheticInfo = {
          symbol,
          priceFeed,
          tic,
          ticAddress,
          syntheticToken,
          syntheticTokenAddress,
          collateralToken,
          collateralTokenAddress,
        };

        return info;
      }),
    );
  }

  start() {
    this.interval = setInterval(() => {
      let started: number = performance.now();

      Promise.all(
        this.syntheticInfos.map(info =>
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
    clearInterval(this.interval);
  }

  async getContract(address: string, contractName: string): Promise<Contract> {
    return await this.web3.getContract(address, {
      type: 'build-artifact',
      contractName: contractName,
    });
  }

  private async checkRequests<T extends ExtendsRequest>(
    info: SyntheticInfo,
    getRequestsMethod: ContractMethod<T[]>,
    approveRequestMethod: ContractMethod<string, [string]>,
    rejectRequestMethod: ContractMethod<string, [string]>,
    callback: (
      request: T,
      price: number,
      requestTime: number,
    ) => Promise<boolean>,
  ) {
    const requests = await getRequestsMethod().call({
      from: this.web3.getDefaultAccount(),
    });

    this.logger.info(`Found ${requests.length} request(s)`);

    for (const request of requests) {
      const { priceFeed } = info;
      const requestTime = request[1];
      const ohlc = await this.getPriceFeedOhlc(priceFeed, requestTime);
      let approve = false;
      if (ohlc['c'].length > 0) {
        const price = priceFeed === 'USDCHF' ? 1 / ohlc['c'][0] : ohlc['c'][0];

        this.logger.info(
          `${info.symbol} was ${price} for request ${request[0]}`,
        );

        approve = await callback(request, price, requestTime);
      } else {
        this.logger.info('Forex is closed');
      }

      await this.finishRequest(
        request[0],
        approve ? approveRequestMethod : rejectRequestMethod,
        approve ? 'Approved' : 'Rejected',
      );
    }
  }

  private async checkMintRequests(info: SyntheticInfo) {
    await this.checkRequests<MintOrRedeemRequest>(
      info,
      info.tic.methods.getMintRequests,
      info.tic.methods.approveMint,
      info.tic.methods.rejectMint,
      async (request, price) => {
        const collateral = request[3][0];
        const tokens = request[4][0];

        this.logger.info(
          `Minting ${tokens} tokens with ${collateral} collateral`,
        );

        if (collateral < tokens * price * (1 - this.maxSlippage)) {
          this.logger.info(`Mint request ${request[0]} is undercollateralized`);
          return false;
        }

        const sender = request[2];
        const allowance = await info.collateralToken.methods
          .allowance(sender, info.tic.options.address)
          .call();
        let balance = await info.collateralToken.methods
          .balanceOf(sender)
          .call();

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

  private async checkRedeemRequests(info: SyntheticInfo) {
    await this.checkRequests<MintOrRedeemRequest>(
      info,
      info.tic.methods.getRedeemRequests,
      info.tic.methods.approveRedeem,
      info.tic.methods.rejectRedeem,
      async (request, price) => {
        const collateral = request[3][0];
        const tokens = request[4][0];

        this.logger.info(
          `Redeeming ${tokens} tokens with ${collateral} collateral`,
        );

        if (collateral > tokens * price * (1 + this.maxSlippage)) {
          this.logger.info(
            `Redeem request ${request[0]} is undercollateralized`,
          );
          return false;
        }

        let sender = request[2];
        let allowance = await info.syntheticToken.methods
          .allowance(sender, info.tic.options.address)
          .call();
        let balance = await info.syntheticToken.methods
          .balanceOf(sender)
          .call();

        if (balance < tokens) {
          this.logger.info(
            `Redeem request ${request[0]} is not covered by user's ${info.symbol} balance`,
          );
          return false;
        }

        if (allowance < tokens) {
          this.logger.info(
            `Unable to approve redeem request ${request[0]} until TIC is given an allowance to transfer the user's collateral`,
          );
          return false;
        }

        return true;
      },
    );
  }

  private async checkExchangeRequests(info: SyntheticInfo) {
    await this.checkRequests<ExchangeRequest>(
      info,
      info.tic.methods.getExchangeRequests,
      info.tic.methods.approveExchange,
      info.tic.methods.rejectExchange,
      async (request, price, requestTime) => {
        let destTic = request[3];
        let destinationInfo: SyntheticInfo;

        for (const currentInfo of this.syntheticInfos) {
          if (currentInfo.tic.options.address === destTic) {
            destinationInfo = currentInfo;
            break;
          }
        }

        if (!info) {
          this.logger.warn(`No TIC configured for address ${request[3]}`);
          return false;
        }

        let destinationPriceFeed = destinationInfo.priceFeed;
        let destinationOhlc = await this.getPriceFeedOhlc(
          destinationPriceFeed,
          requestTime,
        );

        if (destinationOhlc['c'].length === 0) {
          this.logger.info('Forex is closed');
          return false;
        }

        const destPrice =
          destinationPriceFeed === 'USDCHF'
            ? 1 / destinationOhlc['c'][0]
            : destinationOhlc['c'][0];

        this.logger.info(
          `${destinationInfo.symbol} was ${destPrice} for exchange request ${request[0]}`,
        );

        let tokens = request[4][0];
        let destTokens = request[5][0];

        if (tokens * price < destTokens * destPrice * (1 - this.maxSlippage)) {
          this.logger.info(
            `Exchange request ${request[0]} transfers too many destination tokens`,
          );
          return false;
        }

        let sender = request[2];
        let allowance = await info.syntheticToken.methods
          .allowance(sender, info.tic.options.address)
          .call();
        let balance = await info.syntheticToken.methods
          .balanceOf(sender)
          .call();
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

  async getPriceFeedOhlc(
    priceFeed: string,
    requestTime: number,
  ): Promise<OHLC> {
    const endpoint = 'https://data.jarvis.exchange/jarvis/prices/history';

    const query = new URLSearchParams({
      symbol: priceFeed,
      resolution: '1',
      from: (requestTime - 60).toString(),
      to: requestTime.toString(),
    });
    return await axios.get(`${endpoint}${query.toString()}`);
  }

  async finishRequest(
    requestId: string,
    resolveCallback: ContractMethod<string, [string]>,
    resolveLabel: string,
  ) {
    try {
      const txHash = await resolveCallback(requestId).call({
        from: this.web3.getDefaultAccount(),
      });
      // const txReceipt = await this.web3.getTransactionReceipt(txHash);

      this.logger.info(
        `${resolveLabel} request ${requestId} in transaction ${txHash}`,
      );
    } catch (error) {
      if (error.message.contains('BlockNotFound')) this.logger.warn(error);
      if (error.message.contains('ValueError')) {
        this.logger.warn(error);
        this.logger.warn(
          `Make sure there the LP has deposited enough the excess collateral required for the ${resolveLabel} request`,
        );
      }
    }
  }
}
