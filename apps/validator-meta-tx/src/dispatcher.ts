import { createEverLogger } from '@jarvis-network/validator-lib';
import { INestApplicationContext, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { useContainer } from 'class-validator';
import cors from 'cors';
import { FlubErrorHandler } from 'nestjs-flub';
import { AppModule } from './app.module';
import { env } from './config';
/**
 * Start and Stop the Application
 * @export
 * @class AppDispatcher
 */
export class AppDispatcher {
  private app: any;
  private logger = createEverLogger({
    name: 'validator-meta-tx',
  });
  /**
   * Trigger the server
   * @returns {Promise<void>}
   * @memberof AppDispatcher
   */
  async dispatch(): Promise<void> {
    await this.createServer();
    return this.startServer();
  }

  /**
   * Stop the Server
   * @returns {Promise<void>}
   * @memberof AppDispatcher
   */
  async shutdown(): Promise<void> {
    await this.app.close();
  }

  /**
   * `AppModule` Context
   * @returns {Promise<INestApplicationContext>}
   * @memberof AppDispatcher
   */
  public getContext(): Promise<INestApplicationContext> {
    return NestFactory.createApplicationContext(AppModule);
  }

  /**
   * Initialize the server
   * @private
   * @returns {Promise<void>}
   * @memberof AppDispatcher
   */
  private async createServer(): Promise<void> {
    this.app = await NestFactory.create(AppModule, { cors: true });
    useContainer(this.app.select(AppModule), { fallbackOnErrors: true });
    this.app.use(cors());
    process.setMaxListeners(0);
    this.app.useGlobalFilters(
      new FlubErrorHandler({ theme: 'dark', quote: true }),
    );
    this.app.useGlobalPipes(new ValidationPipe());

    // await this.app.startAllMicroservicesAsync();
  }

  /**
   * Start the server
   * @private
   * @returns {Promise<void>}
   * @memberof AppDispatcher
   */
  private async startServer(): Promise<void> {
    const host = env.HOST;
    const port = env.PORT;
    await this.app.listen(port, host);
    this.logger.info(
      `😎 Graphql Server is listening http://${host}:${port} 😎`,
    );
  }
}
