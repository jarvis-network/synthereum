/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
// import exitHook from 'async-exit-hook';
/* eslint-disable */
import { createEverLogger } from '@jarvis-network/validator-lib';
import 'dotenv/config';
import 'reflect-metadata';
import { AppDispatcher } from './dispatcher';

const log = createEverLogger({ name: 'uncaught' });

const dispatcher = new AppDispatcher();

dispatcher
  .dispatch()
  .then(() => log.info('Everything up running'))
  .catch(error => {
    log.error(error.message, error.stack);
    process.exit();
  });

// exitHook((callback) => {
//   void dispatcher.shutdown().then(() => {
//     log.info('Graceful shutdown the server');
//     callback();
//   });
// });
process.on('uncaughtException', error => {
  try {
    log.error(error, `Caught exception: ${error}`);
  } catch (error_) {
    try {
      console.error("Can't write to log!!!!!!");
      console.error(error_);
    } catch {}
  }

  console.error(error);
});

process.on('unhandledRejection', error => {
  try {
    log.error(error, `Uncaught rejection: ${error}`);
  } catch (error_) {
    try {
      console.error("Can't write to log!!!!!!");
      console.error(error_);
    } catch {}
  }

  console.error(error);
});
