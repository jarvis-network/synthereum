import { createEverLogger } from '@jarvis-network/validator-lib';
import { Body, Controller, Post } from '@nestjs/common';
import { ExchangeRequestDTO } from './dto/exchange.dto';
import { MintRequestDTO } from './dto/mint.dto';
import { RedeemRequestDTO } from './dto/redeem.dto';
import { MetaTransactionService } from './metatx.service';
@Controller('/meta-tx')
export class MetaTransactionController {
  private logger = createEverLogger({
    name: 'meta-tx-controller',
  });
  constructor(private metaTxService: MetaTransactionService) {}
  @Post('exchange')
  async exchangeRequest(@Body() dto: ExchangeRequestDTO) {
    this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);
    const message = this.metaTxService.exchangeRequest(dto);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }
  @Post('mint')
  async mintRequest(@Body() dto: MintRequestDTO) {
    this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);
    const message = this.metaTxService.mintRequest(dto);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }
  @Post('redeem')
  async redeemRequest(@Body() dto: RedeemRequestDTO) {
    this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);
    const message = this.metaTxService.redeemRequest(dto);
    this.logger.info(`Generated payload >> ${message}`);
    return message;
  }
}
