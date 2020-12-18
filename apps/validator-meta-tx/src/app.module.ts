import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { MetaTransactionModule } from './meta-transactions/metatx.module';
import { TimeoutInterceptor } from './shared/interceptors/timeout.interceptors';

@Module({
  imports: [TerminusModule, MetaTransactionModule],

  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
  ],
})
export class AppModule {}
