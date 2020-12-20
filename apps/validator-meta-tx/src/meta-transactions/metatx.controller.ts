import { createEverLogger } from '@jarvis-network/validator-lib';
import { Body, Controller, Post } from '@nestjs/common';
import { ParseError } from 'src/erros/messages';
import { ExchangeRequestDTO } from './dto/exchange.dto';
import { MintRequestParams, mintRequestSchema } from './dto/mint.dto';
import { RedeemRequestParams, redeemRequestSchema } from './dto/redeem.dto';
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
  async mintRequest(@Body() dto: MintRequestParams) {
    try {
      await mintRequestSchema.validate(dto, {
        abortEarly: false,
      });
      this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);

      const message = { check: true };
      // this.metaTxService.mintRequest(dto);
      //this.logger.info(`Generated payload >> ${message}`);
      return message;
    } catch (error) {
      this.logger.error(error);
      return ParseError(error, 'Validation Failed');
    }
  }
  @Post('redeem')
  async redeemRequest(@Body() dto: RedeemRequestParams) {
    try {
      await redeemRequestSchema.validate(dto, {
        abortEarly: false,
      });
      this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);

      this.logger.info(`Request Received >> ${JSON.stringify(dto, null, ' ')}`);
      const message = this.metaTxService.redeemRequest(dto);
      this.logger.info(`Generated payload >> ${message}`);
      return message;
    } catch (error) {
      this.logger.error(error);
      return ParseError(error, 'Validation Failed');
    }
  }
}
