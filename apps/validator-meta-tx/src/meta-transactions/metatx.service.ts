import {
  ExchangeService,
  MintService,
  RedeemService,
} from '@jarvis-network/meta-tx-lib';
import { IExchangeRequest } from '@jarvis-network/meta-tx-lib/src/interfaces/exchange.interface';
import { fees } from '@jarvis-network/synthereum-contracts/dist/src/config/data/fees';
import {
  parseSupportedNetworkId,
  SupportedNetworkId,
  SupportedNetworkName,
} from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import {
  createEverLogger,
  ExchangeRequest,
  ExchangeRequestValidator,
  getSynthereumRealmWithInfuraWeb3,
  MintRequest,
  MintRequestValidator,
  PriceFeed,
  RedeemRequest,
  RedeemRequestValidator,
} from '@jarvis-network/validator-lib';
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ENV, env } from '../config';
import { ExchangeRequestDTO } from './dto/exchange.dto';
import { MintRequestParams } from './dto/mint.dto';
import { RedeemRequestParams } from './dto/redeem.dto';

@Injectable()
export class MetaTransactionService {
  private logger = createEverLogger({
    name: 'meta-tx-service',
  });
  exchangeService: ExchangeService;
  mintService: MintService;
  redeemService: RedeemService;
  mintValidator: MintRequestValidator;
  redeemValidator: RedeemRequestValidator;
  exchangeValidator: ExchangeRequestValidator;
  priceFeed: PriceFeed;
  realm: SynthereumRealmWithWeb3<'kovan'>;
  web3: Web3On<SupportedNetworkName>;
  constructor() {
    this.init();
  }
  async init() {
    this.realm = await getSynthereumRealmWithInfuraWeb3();
    this.logger.info(`Realm loaded`);
    this.exchangeService = new ExchangeService();
    this.mintService = new MintService();
    this.redeemService = new RedeemService();
    this.priceFeed = new PriceFeed();
    this.priceFeed.connect();
    this.logger.info(`Connected to PriceFeed`);
    const netId: SupportedNetworkId = parseSupportedNetworkId(env.NETWORK_ID);
    this.web3 = getInfuraWeb3(netId);
    this.logger.info(`Connected to Web3`);
    const _env = {
      MAX_SLIPPAGE: env.MAX_SLIPPAGE,
    } as ENV;
    this.mintValidator = new MintRequestValidator(this.priceFeed, _env);
    this.redeemValidator = new RedeemRequestValidator(this.priceFeed, _env);
    this.exchangeValidator = new ExchangeRequestValidator(
      this.priceFeed,
      this.realm,
      _env,
    );
  }

  destroy() {
    this.priceFeed.disconnect();
  }

  async exchangeRequest(dto: ExchangeRequestDTO): Promise<Uint8Array> {
    this.logger.info(
      `Validating the payload payload >> ${JSON.stringify(dto, null, ' ')}`,
    );
    const isValid = await this.exchangeValidator.CheckRequest(
      this.realm.ticInstances[dto.asset],
      {
        sender: dto.sender,
        dest_tic: this.realm.ticInstances[dto.dest_asset].address,
        collateral_amount: [dto.collateral_amount],
        num_tokens: [dto.num_tokens],
        dest_num_tokens: [dto.dest_num_tokens],
        timestamp: DateTime.local().toMillis().toString(),
        exchange_id: 'RandomRequestId',
      } as ExchangeRequest,
    );
    if (!isValid) {
      throw new Error('Not valid request');
    }
    const nonce = await this.web3.eth.getTransactionCount(dto.sender);

    this.logger.info(`Generating payload >> ${JSON.stringify(dto, null, ' ')}`);
    const message = this.exchangeService.createMessageBody({
      sender: assertIsAddress<SupportedNetworkName>(dto.sender),
      derivativeAddr: assertIsAddress<SupportedNetworkName>(
        this.realm.ticInstances[dto.asset].address,
      ),
      destPoolAddr: assertIsAddress<SupportedNetworkName>('SomePoolAddress'),
      destDerivativeAddr: assertIsAddress<SupportedNetworkName>(
        this.realm.ticInstances[dto.dest_asset].address,
      ),
      numTokens: new FPN(dto.num_tokens),
      collateralAmount: new FPN(dto.collateral_amount),
      destNumTokens: new FPN(dto.dest_num_tokens),
      feePercentage: new FPN(fees[42].feePercentage),
      nonce: new FPN(nonce),
      expiry: DateTime.local().plus({ minutes: 5 }).toMillis().toString(),
    } as IExchangeRequest);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }

  async redeemRequest(dto: RedeemRequestParams): Promise<Uint8Array> {
    this.logger.info(
      `Validating the payload payload >> ${JSON.stringify(dto, null, ' ')}`,
    );
    const isValid = await this.redeemValidator.CheckRequest(
      this.realm.ticInstances[dto.asset],
      {
        sender: dto.sender,
        collateral_amount: [dto.collateral_amount],
        num_tokens: [dto.num_tokens],
        timestamp: DateTime.local().toMillis().toString(),
        redeem_id: 'RandomRequestId',
      } as RedeemRequest,
    );
    if (!isValid) {
      throw new Error('Not valid request');
    }
    const nonce = await this.web3.eth.getTransactionCount(dto.sender);

    this.logger.info(`Generating payload >> ${JSON.stringify(dto, null, ' ')}`);
    const message = this.exchangeService.createMessageBody({
      sender: assertIsAddress<SupportedNetworkName>(dto.sender),
      derivativeAddr: assertIsAddress<SupportedNetworkName>(
        this.realm.ticInstances[dto.asset].address,
      ),
      numTokens: new FPN(dto.num_tokens),
      collateralAmount: new FPN(dto.collateral_amount),
      feePercentage: new FPN(fees[42].feePercentage),
      nonce: new FPN(nonce),
      expiry: DateTime.local().plus({ minutes: 5 }).toMillis().toString(),
    } as IExchangeRequest);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }

  async mintRequest(dto: MintRequestParams): Promise<Uint8Array> {
    this.logger.info(
      `Validating the payload payload >> ${JSON.stringify(dto, null, ' ')}`,
    );

    const isValid = await this.mintValidator.CheckRequest(
      this.realm.ticInstances[dto.asset],
      {
        sender: dto.sender,
        collateral_amount: [dto.collateral_amount],
        num_tokens: [dto.num_tokens],
        timestamp: DateTime.local().toMillis().toString(),
        mint_id: 'RandomRequestId',
      } as MintRequest,
    );
    if (!isValid) {
      throw new Error('Not valid request');
    }
    const nonce = await this.web3.eth.getTransactionCount(dto.sender);

    this.logger.info(`Generating payload >> ${JSON.stringify(dto, null, ' ')}`);
    const message = this.exchangeService.createMessageBody({
      sender: assertIsAddress<SupportedNetworkName>(dto.sender),
      derivativeAddr: assertIsAddress<SupportedNetworkName>(
        this.realm.ticInstances[dto.asset].address,
      ),
      numTokens: new FPN(dto.num_tokens),
      collateralAmount: new FPN(dto.collateral_amount),
      feePercentage: new FPN(fees[42].feePercentage),
      nonce: new FPN(nonce),
      expiry: DateTime.local().plus({ minutes: 5 }).toMillis().toString(),
    } as IExchangeRequest);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }
}
