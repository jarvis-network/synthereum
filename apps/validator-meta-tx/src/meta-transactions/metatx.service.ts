import {
  ExchangeService,
  MintService,
  RedeemService,
} from '@jarvis-network/meta-tx-lib';
import { IExchangeRequest } from '@jarvis-network/meta-tx-lib/src/interfaces/exchange.interface';
import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { SynthereumRealmWithWeb3 } from '@jarvis-network/synthereum-contracts/dist/src/core/types';
import {
  createEverLogger,
  ExchangeRequest,
  ExchangeRequestValidator,
  getSynthereumRealmWithInfuraWeb3,
  MintRequest,
  MintRequestValidator,
  RedeemRequest,
  RedeemRequestValidator,
} from '@jarvis-network/validator-lib';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';
import { Injectable } from '@nestjs/common';
import { ENV, env } from '../config';
import { ExchangeRequestDTO } from './dto/exchange.dto';
import { MintRequestDTO } from './dto/mint.dto';
import { RedeemRequestDTO } from './dto/redeem.dto';
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
  realm: SynthereumRealmWithWeb3<'kovan'>;
  constructor() {
    this.init();
  }
  async init() {
    this.realm = await getSynthereumRealmWithInfuraWeb3();
    this.exchangeService = new ExchangeService();
    this.mintService = new MintService();
    this.redeemService = new RedeemService();
    this.mintValidator = new MintRequestValidator({
      MAX_SLIPPAGE: env.MAX_SLIPPAGE,
    } as ENV);
    this.redeemValidator = new RedeemRequestValidator({
      MAX_SLIPPAGE: env.MAX_SLIPPAGE,
    } as ENV);
    this.exchangeValidator = new ExchangeRequestValidator(this.realm, {
      MAX_SLIPPAGE: env.MAX_SLIPPAGE,
    } as ENV);
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
        timestamp: 'noTimestamp',
        exchange_id: 'RandomRequestId',
      } as ExchangeRequest,
    );
    if (!isValid) {
      throw new Error('Not valid request');
    }
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
      feePercentage: new FPN('100'),
      expiry: '12',
    } as IExchangeRequest);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }

  async redeemRequest(dto: RedeemRequestDTO): Promise<Uint8Array> {
    this.logger.info(
      `Validating the payload payload >> ${JSON.stringify(dto, null, ' ')}`,
    );
    const isValid = await this.redeemValidator.CheckRequest(
      this.realm.ticInstances[dto.asset],
      {
        sender: dto.sender,
        collateral_amount: [dto.collateral_amount],
        num_tokens: [dto.num_tokens],
        timestamp: 'noTimestamp',
        redeem_id: 'RandomRequestId',
      } as RedeemRequest,
    );
    if (!isValid) {
      throw new Error('Not valid request');
    }
    this.logger.info(`Generating payload >> ${JSON.stringify(dto, null, ' ')}`);
    const message = this.exchangeService.createMessageBody({
      sender: assertIsAddress<SupportedNetworkName>(dto.sender),
      derivativeAddr: assertIsAddress<SupportedNetworkName>(
        this.realm.ticInstances[dto.asset].address,
      ),
      numTokens: new FPN(dto.num_tokens),
      collateralAmount: new FPN(dto.collateral_amount),
      feePercentage: new FPN('100'),
      nonce: new FPN('100'),
      expiry: '12',
    } as IExchangeRequest);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }

  async mintRequest(dto: MintRequestDTO): Promise<Uint8Array> {
    this.logger.info(
      `Validating the payload payload >> ${JSON.stringify(dto, null, ' ')}`,
    );
    const isValid = await this.mintValidator.CheckRequest(
      this.realm.ticInstances[dto.asset],
      {
        sender: dto.sender,
        collateral_amount: [dto.collateral_amount],
        num_tokens: [dto.num_tokens],
        timestamp: 'noTimestamp',
        mint_id: 'RandomRequestId',
      } as MintRequest,
    );
    if (!isValid) {
      throw new Error('Not valid request');
    }
    this.logger.info(`Generating payload >> ${JSON.stringify(dto, null, ' ')}`);
    const message = this.exchangeService.createMessageBody({
      sender: assertIsAddress<SupportedNetworkName>(dto.sender),
      derivativeAddr: assertIsAddress<SupportedNetworkName>(
        this.realm.ticInstances[dto.asset].address,
      ),
      numTokens: new FPN(dto.num_tokens),
      collateralAmount: new FPN(dto.collateral_amount),
      feePercentage: new FPN('100'),
      nonce: new FPN('100'),
      expiry: '12',
    } as IExchangeRequest);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }
}
