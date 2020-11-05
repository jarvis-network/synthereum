import { Logger } from '../logger';
import * as bunyan from 'bunyan';
import { performance } from 'perf_hooks';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import axios from 'axios';
import { Web3Service } from '@jarvis/web3-utils';
import path from 'path';
import fs from 'fs';

interface SyntheticInfo {
  ticAddress: string;
  tic: Contract;
  collateralTokenAddress: string;
  collateralToken: Contract;
  syntheticTokenAddress: string;
  syntheticToken: Contract;
}

export default class SynFiatKeeper {
  mintInterval: any;
  redeemInterval: any;
  exchangeInterval: any;
  web3: Web3Service;
  logger: bunyan;
  maxSlippage: number;
  ticConfig: any;
  factoryABI: AbiItem[];
  ticAddresses: string[] = [];
  ticABI: any;
  tics: any[] = [];
  collateralTokenAddresses: string[] = [];
  erc20ABI: AbiItem[];
  collateralTokens: any[] = [];
  syntheticTokenAddresses: any[] = [];
  syntheticTokens: any[] = [];
  mintRequests: any[];
  frequency: number;

  constructor(web3: Web3Service, env: any, logger?: bunyan) {
    this.web3 = web3;
    this.logger = logger || Logger('KeeperBot', 'logging', 'info');

    this.frequency = Number.parseInt(env.FREQUENCY);
    this.maxSlippage = Number.parseFloat(env.MAX_SLIPPAGE);
  }

  async loadContracts() {
    this.ticConfig = JSON.parse(
      fs
        .readFileSync(path.resolve(__dirname, '..', '..', 'config', 'tic.json'))
        .toString(),
    );
    const synthetics = this.ticConfig['synthetics'] as any[];

    // 1) Obtain TICFactory instace
    let factory = await this.getContract(
      this.ticConfig['factory_address'],
      'TICFactory',
    );
    const syntheticInfos = await Promise.all(
      synthetics.map(async (synthetic: any) => {
        let symbol = synthetic['symbol']; // say jEUR

        // 2) Get TIC instance for jEUR
        let ticAddress = await factory.methods.symbolToTIC(symbol).call();
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
    syntheticInfos.map(info => {
      for (const key in info) {
        const pluralKey = (key[key.length - 1] === 's'
          ? key + 'es'
          : key + 's') as keyof SynFiatKeeper;
        (this[pluralKey] as any[]).push(info[key as keyof typeof info]);
      }
    });
  }

  async start() {
    this.mintInterval = setInterval(
      this.checkMintRequests.bind(this),
      1000 * this.frequency,
    );
    this.redeemInterval = setInterval(
      this.checkRedeemRequests.bind(this),
      1000 * this.frequency,
    );
    this.exchangeInterval = setInterval(
      this.checkExchangeRequests.bind(this),
      1000 * this.frequency,
    );
  }

  async getContract(address: string, contractName: string): Promise<Contract> {
    return await this.web3.getContract(address, {
      type: 'build-artifact',
      contractName: contractName,
    });
  }

  checkMintRequests() {
    let started: number = performance.now();
    this.mintRequests;
    this.tics.forEach(async (tic, i) => {
      this.mintRequests = await tic.methods
        .getMintRequests()
        .call({ from: this.web3.getDefaultAccount() });

      this.logger.info(`Found ${this.mintRequests.length} mint request(s)`);

      this.mintRequests.forEach(mint => {
        let reject: boolean = false;
        let priceFeed = this.ticConfig['synthetics'][i];

        let requestTime = mint[1];

        let ohlc: any = this.getPriceFeedOhlc(priceFeed, requestTime);

        let price: number;
        if (ohlc['c'].length > 0) {
          if (priceFeed == 'USDCHF') {
            price = 1 / ohlc['c'][0];
          } else {
            price = ohlc['c'][0];
          }

          this.logger.info(
            `${
              this.ticConfig['synthetics'][i]['symbol']
            } was ${price} for mint request ${mint[0].hex()}`,
          );

          let collateral = mint[3][0];
          let tokens = mint[4][0];

          this.logger.info(
            `Minting ${tokens} tokens with ${collateral} collateral`,
          );

          if (collateral >= tokens * price * (1 - this.maxSlippage)) {
            let sender = mint[2];
            let allowance = this.collateralTokens[i].methods
              .allowance(sender, tic.address)
              .call();
            let balance = this.collateralTokens[i].methods
              .balanceOf(sender)
              .call();

            if (balance >= collateral) {
              if (allowance >= collateral) {
                this.resolveRequest(
                  mint[0],
                  tic.methods.approveMint,
                  'Approved mint',
                );
              } else {
                reject = true;
                this.logger.info(
                  `Unable to approve mint request ${mint[0].hex()} until TIC is given an allowance to transfer the user's collateral`,
                );
              }
            } else {
              reject = true;
              this.logger.info(
                `Mint request ${mint[0].hex()} is not covered by user's collateral balance`,
              );
            }
          } else {
            reject = true;
            this.logger.info(
              `Mint request ${mint[0].hex()} is undercollateralized`,
            );
          }
        } else {
          reject = true;
          this.logger.info('Forex is closed');
        }

        if (reject) {
          this.resolveRequest(mint[0], tic.methods.rejectMint, 'Rejected mint');
        }
        this.logger.info(
          `Checked mint requests in ${
            (performance.now() - started) / 1000
          } second(s)`,
        ); // miliseconds to seconds is /1000
      });
    });
  }

  checkRedeemRequests() {
    let started: number = performance.now();

    this.tics.forEach(async (tic, i) => {
      let redeemRequests: any[] = await tic.methods
        .getRedeemRequests()
        .call({ from: this.web3.getDefaultAccount() });
      this.logger.info(`Found ${redeemRequests.length} redeem request(s)`);

      redeemRequests.forEach(redeem => {
        let reject: boolean = false;
        let priceFeed = this.ticConfig['synthetics'][i]['price_feed'];
        let requestTime = redeem[1];
        let ohlc: any = this.getPriceFeedOhlc(priceFeed, requestTime);

        if (ohlc['c'].length > 0) {
          let price;
          if (priceFeed == 'USDCHF') {
            price = 1 / ohlc['c'][0];
          } else {
            price = ohlc['c'][0];
          }

          this.logger.info(
            `${
              this.ticConfig['synthetics'][i]['symbol']
            } was ${price} for redeem request ${redeem[0].hex()}`,
          );

          let collateral = redeem[3][0];
          let tokens = redeem[4][0];

          this.logger.info(
            `Redeeming ${tokens} tokens with {collateral} collateral`,
          );

          if (collateral <= tokens * price * (1 + this.maxSlippage)) {
            let sender = redeem[2];
            let allowance = this.syntheticTokens[i].methods
              .allowance(sender, tic.address)
              .call();
            let balance = this.syntheticTokens[i].menthods
              .balanceOf(sender)
              .call();

            if (balance >= tokens) {
              if (allowance >= tokens) {
                this.resolveRequest(
                  redeem[0],
                  tic.methods.approveRedeem,
                  'Approved redeem',
                );
              } else {
                reject = true;
                this.logger.info(
                  `Unable to approve redeem request ${redeem[0].hex()} until TIC is given an allowance to transfer the user's collateral`,
                );
              }
            } else {
              reject = true;
              this.logger.info(
                `Redeem request ${redeem[0].hex()} is not covered by user's ${
                  this.ticConfig['synthetics'][i]['symbol']
                } balance`,
              );
            }
          } else {
            reject = true;
            this.logger.info(
              `Redeem request ${redeem[0].hex()} is undercollateralized`,
            );
          }
        } else {
          reject = true;
          this.logger.info('Forex is closed');
        }

        if (reject) {
          this.resolveRequest(
            redeem[0],
            tic.methods.rejectRedeem,
            'Rejected redeem',
          );
        }

        this.logger.info(
          `Checked redeem requests in ${
            (performance.now() - started) / 1000
          } second(s)`,
        );
      });
    });
  }

  checkExchangeRequests() {
    const started: number = performance.now();
    this.tics.forEach(async (tic, i) => {
      let exchangeRequests: any[] = await tic.methods
        .getExchangeRequests()
        .call({ from: this.web3.getDefaultAccount() });
      this.logger.info(`Found ${exchangeRequests.length} exchange request(s)`);

      for (let i = 0; i < exchangeRequests.length; i++) {
        let exchange = exchangeRequests[i];
        let reject: boolean = false;
        let priceFeed = this.ticConfig['synthetics'][i]['price_feed'];
        let requestTime = exchange[1];
        let ohlc: any = this.getPriceFeedOhlc(priceFeed, requestTime);

        if (ohlc['c'].length > 0) {
          let price;
          if (priceFeed == 'USDCHF') {
            price = 1 / ohlc['c'][0];
          } else {
            price = ohlc['c'][0];
          }

          this.logger.info(
            `${
              this.ticConfig['synthetics'][i]['symbol']
            } was ${price} for exchange request ${exchange[0].hex()}`,
          );

          let destTic = exchange[3];
          let destTicIndex = -1;

          for (let j = 0; j < this.tics.length; j++) {
            let address = this.tics[j];
            if (address === destTic) {
              destTicIndex = j;
              break;
            }
          }

          if (destTicIndex === -1) {
            this.logger.warn(`No TIC configured for address ${exchange[3]}`);
            continue;
          }

          let destPriceFeed = this.ticConfig['synthetics'][destTicIndex][
            'price_feed'
          ];
          let destOhlc: any = this.getPriceFeedOhlc(destPriceFeed, requestTime);

          if (destOhlc['c'] > 0) {
            let destPrice;
            if (priceFeed == 'USDCHF') {
              destPrice = 1 / destOhlc['c'][0];
            } else {
              destPrice = destOhlc['c'][0];
            }

            this.logger.info(
              `${
                this.ticConfig['synthetics'][destTicIndex]['symbol']
              } was ${destPrice} for exchange request ${exchange[0].hex()}`,
            );

            let tokens = exchange[4][0];
            let destTokens = exchange[5][0];

            if (
              tokens * price >=
              destTokens * destPrice * (1 - this.maxSlippage)
            ) {
              let sender = exchange[2];
              let allowance = this.syntheticTokens[i].methods
                .allowance(sender, tic.address)
                .call();
              let balance = this.syntheticTokens[i].methods
                .balanceOf(sender)
                .call();

              if (balance >= tokens) {
                if (allowance >= tokens) {
                  this.resolveRequest(
                    exchange[0],
                    tic.methods.approveExchange,
                    'Approved exchange',
                  );
                } else {
                  reject = true;
                  this.logger.info(
                    `Unable to approve exchange request ${exchange[0].hex()} until TIC is given an allowance to transfer the user's tokens`,
                  );
                }
              } else {
                reject = true;
                this.logger.info(
                  `Exchange request ${exchange[0].hex()} is not covered by user's ${
                    this.ticConfig['synthetics'][i]['symbol']
                  } balance`,
                );
              }
            } else {
              reject = true;
              this.logger.info(
                `Exchange request ${exchange[0].hex()} transfers too many destination tokens`,
              );
            }
          } else {
            reject = true;
            this.logger.info('Forex is closed');
          }
        } else {
          reject = true;
          this.logger.info('Forex is closed');
        }

        if (reject) {
          this.resolveRequest(
            exchange[0],
            tic.methods.rejectRedeem,
            'Rejected exchange',
          );
        }
      }
    });
    this.logger.info(
      `Checked exchange requests in ${
        (performance.now() - started) / 1000
      } second(s)`,
    );
  }

  async getPriceFeedOhlc(priceFeed: any, requestTime: any) {
    const endpoint = 'https://data.jarvis.exchange/jarvis/prices/history';
    let response;

    let query = `?symbol=${priceFeed}&resolution=1&from=${
      requestTime - 60
    }&to=${requestTime}`;
    try {
      response = await axios.get(`${endpoint}${query}`);
    } catch (error) {
      this.logger.error(error);
    }

    return response;
  }

  resolveRequest(requestId: any, resolveCallback: any, resolveLabel: any) {
    try {
      let txHash = resolveCallback(requestId).transact({
        from: this.web3.getDefaultAccount(),
      });
      let txReceipt = this.web3.getTransactionReceipt(txHash);

      this.logger.info(
        `${resolveLabel} request ${requestId.hex()} in transaction ${txHash.hex()}`,
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
