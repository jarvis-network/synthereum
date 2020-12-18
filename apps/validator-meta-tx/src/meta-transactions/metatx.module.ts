import { Module } from '@nestjs/common';
import { MetaTransactionController } from './metatx.controller';
import { MetaTransactionService } from './metatx.service';

@Module({
  controllers: [MetaTransactionController],
  providers: [MetaTransactionService],
})
export class MetaTransactionModule {}
