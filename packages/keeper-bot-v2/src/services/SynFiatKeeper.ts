import { Logger } from '../logger';
import * as bunyan from 'bunyan';
import { performance } from 'perf_hooks';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import type { ENV } from '../config';
import {
  BaseContract,
  NonPayableTransactionObject,
  Web3Service,
} from '@jarvis/web3-utils';
import type { TICInterface } from '@jarvis/synthereum-contracts/src/contracts/TICInterface';
import type { TICFactory } from '@jarvis/synthereum-contracts/src/contracts/TICFactory';
import type { ERC20 } from '@jarvis/synthereum-contracts/src/contracts/ERC20';
import { parseTokens, scale } from './maths';

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

type OHLC = {
  c: [number] | [];
};

interface SyntheticInfo {
  symbol: string;
  priceFeed: string;
  ticAddress: string;
  tic: TICInterface;
  collateralTokenAddress: string;
  collateralToken: ERC20;
  collateralDecimals: number;
  syntheticTokenAddress: string;
  syntheticToken: ERC20;
  syntheticDecimals: number;
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
    let factory = await this.getContract<TICFactory>(
      ticConfig.factory_address,
      'TICFactory',
    );

    this.syntheticInfos = await Promise.all(
      ticConfig.synthetics.map(async ({ symbol, price_feed: priceFeed }) => {
        // 2) Get TIC instance for jEUR
        let ticAddress = await factory.methods.symbolToTIC(symbol).call();
        const tic = await this.getContract<TICInterface>(ticAddress, 'TIC');
        // 3) Get the collateral token for jEUR:
        const collateralTokenAddress = await tic.methods
          .collateralToken()
          .call();

        const collateralToken = await this.getContract<ERC20>(
          collateralTokenAddress,
          'ERC20',
        );
        // 4) Get actual synthetic token jEUR:
        const syntheticTokenAddress = await tic.methods.syntheticToken().call();

        const syntheticToken = await this.getContract<ERC20>(
          syntheticTokenAddress,
          'ERC20',
        );

        const info: SyntheticInfo = {
          symbol,
          priceFeed,
          tic,
          ticAddress,
          syntheticToken,
          syntheticTokenAddress,
          syntheticDecimals: parseInt(
            await syntheticToken.methods.decimals().call(),
            10,
          ),
          collateralToken,
          collateralTokenAddress,
          collateralDecimals: parseInt(
            await collateralToken.methods.decimals().call(),
            10,
          ),
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

  async getContract<T extends BaseContract>(
    address: string,
    contractName: string,
  ): Promise<T> {
    return await this.web3.getContract<T>(address, {
      type: 'build-artifact',
      contractName: contractName,
    });
  }

  private async checkRequests<T extends [string, string, string, ...unknown[]]>(
    info: SyntheticInfo,
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
      from: this.web3.getDefaultAccount(),
    });

    this.logger.info(
      `Found ${requests.length} ${type} request(s) for ${info.symbol}`,
    );

    for (const request of requests) {
      const { priceFeed } = info;
      const requestTime = request[1];
      const ohlc = await this.getPriceFeedOhlc(priceFeed, requestTime);
      let approve = false;
      if (ohlc['c'].length > 0) {
        const price = priceFeed === 'USDCHF' ? 1 / ohlc['c'][0] : ohlc['c'][0];

        this.logger.info(
          `${info.symbol} was ${price} for ${type} request ${request[0]}`,
        );

        approve = await callback(request, price, requestTime);
      } else {
        this.logger.info('Forex is closed');
      }

      await this.finishRequest(
        request[0],
        approve ? approveRequestMethod : rejectRequestMethod,
        `${approve ? 'Approved' : 'Rejected'} ${type}`,
      );
    }
  }

  private async checkMintRequests(info: SyntheticInfo) {
    await this.checkRequests<MintOrRedeemRequest>(
      info,
      info.tic.methods.getMintRequests,
      info.tic.methods.approveMint,
      info.tic.methods.rejectMint,
      'mint',
      async (request, price) => {
        const collateral = parseTokens(request[3][0], info.collateralDecimals);
        const tokens = parseTokens(request[4][0], info.syntheticDecimals);

        this.logger.info(
          `Minting ${tokens} tokens with ${collateral} collateral`,
        );

        if (collateral < scale(tokens, price * (1 - this.maxSlippage))) {
          this.logger.info(`Mint request ${request[0]} is undercollateralized`);
          return false;
        }

        const sender = request[2];
        const allowance = parseTokens(
          await info.collateralToken.methods
            .allowance(sender, info.tic.options.address)
            .call(),
          info.collateralDecimals,
        );
        const balance = parseTokens(
          await info.collateralToken.methods.balanceOf(sender).call(),
          info.collateralDecimals,
        );

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
      'redeem',
      async (request, price) => {
        const collateral = parseTokens(request[3][0], info.collateralDecimals);
        const tokens = parseTokens(request[4][0], info.syntheticDecimals);

        this.logger.info(
          `Redeeming ${tokens} tokens with ${collateral} collateral`,
        );

        if (collateral > scale(tokens, price * (1 + this.maxSlippage))) {
          this.logger.info(
            `Redeem request ${request[0]} is undercollateralized`,
          );
          return false;
        }

        const sender = request[2];
        const allowance = parseTokens(
          await info.syntheticToken.methods
            .allowance(sender, info.tic.options.address)
            .call(),
          info.syntheticDecimals,
        );
        const balance = parseTokens(
          await info.syntheticToken.methods.balanceOf(sender).call(),
          info.syntheticDecimals,
        );

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
      'exchange',
      async (request, price, requestTime) => {
        const destTic = request[3];
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

        const { priceFeed: destinationPriceFeed } = destinationInfo;
        const destinationOhlc = await this.getPriceFeedOhlc(
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
            : destinationOhlc['c'][0]; // TODO: Remove

        this.logger.info(
          `${destinationInfo.symbol} was ${destPrice} for exchange request ${request[0]}`,
        );

        let tokens = parseTokens(request[4][0], info.syntheticDecimals);
        let destTokens = parseTokens(request[5][0], info.syntheticDecimals);

        if (
          scale(tokens, price) <
          scale(destTokens, destPrice * (1 - this.maxSlippage))
        ) {
          this.logger.info(
            `Exchange request ${request[0]} transfers too many destination tokens`,
          );
          return false;
        }

        const sender = request[2];
        const allowance = parseTokens(
          await info.syntheticToken.methods
            .allowance(sender, info.tic.options.address)
            .call(),
          info.syntheticDecimals,
        );
        const balance = parseTokens(
          await info.syntheticToken.methods.balanceOf(sender).call(),
          info.syntheticDecimals,
        );
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

  async getPriceFeedOhlc(priceFeed: string, requestTime: string) {
    const endpoint = 'https://data.jarvis.exchange/jarvis/prices/history';

    const query = new URLSearchParams({
      symbol: priceFeed,
      resolution: '1',
      from: (parseInt(requestTime, 10) - 60).toString(),
      to: requestTime,
    });
    const { data } = await axios.get<OHLC>(`${endpoint}?${query.toString()}`);
    // TODO: Invert USDCHF
    // TODO: Return c
    return data;
  }

  async finishRequest(
    requestId: string,
    resolveCallback: ApproveRejectMethod,
    resolveLabel: string,
  ) {
    try {
      const from = this.web3.getDefaultAccount();

      const gasPrice = await this.web3.web3.eth.getGasPrice();
      const gas = await resolveCallback(requestId).estimateGas({ from });

      const transaction = await resolveCallback(requestId).send({
        from,
        gasPrice,
        gas,
      });
      // Wait for the transaction to be mined
      const receipt = await this.web3.getTransactionReceipt(
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
