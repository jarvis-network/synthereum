import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { MetaTransactionModule } from './meta-transactions/metatx.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { TimeoutInterceptor } from './shared/interceptors/timeout.interceptors';

@Module({
  imports: [TerminusModule, MetaTransactionModule],

  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
