import { createEverLogger } from '@jarvis-network/validator-lib';
import { Body, Controller, Post } from '@nestjs/common';
import { ExchangeRequestDTO } from './dto/exchange.dto';
import { MintRequestDTO } from './dto/mint.dto';
import { RedeemRequestDTO } from './dto/redeem.dto';

@Controller('/meta-tx')
export class MetaTransactionController {
  private logger = createEverLogger({
    name: 'meta-tx-controller',
  });
  @Post('exchange')
  async exchangeRequest(@Body() dto: ExchangeRequestDTO) {
    this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);

    throw new Error('Not implemented');
  }
  @Post('mint')
  async mintRequest(@Body() dto: MintRequestDTO) {
    this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);

    throw new Error('Not implemented');
  }
  @Post('redeem')
  async redeemRequest(@Body() dto: RedeemRequestDTO) {
    this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);

    throw new Error('Not implemented');
  }
}
