import { existsSync } from 'fs';

import path from 'path';

import * as Bunyan from 'bunyan';
import PrettyStream from 'bunyan-prettystream';
import mkdirp from 'mkdirp';

import { env } from './config';

export interface ILogArgs {
  // which file used to store logs
  name: string;
}
let isLogsFolderExists = env.LOGS_PATH ? existsSync(env.LOGS_PATH) : false;

const prettyStdOut = new PrettyStream();

prettyStdOut.pipe(process.stdout);

export function createEverLogger({ name }: ILogArgs): Bunyan {
  if (!isLogsFolderExists) {
    mkdirp.sync(env.LOGS_PATH);
    isLogsFolderExists = true;
  }

  const logger = Bunyan.createLogger({
    name: `${name}`,
    serializers: Bunyan.stdSerializers,
    streams: [
      {
        level: 'info',
        path: path.join(env.LOGS_PATH, `info_${name}.log`),
      },
      {
        level: 'error',
        path: path.join(env.LOGS_PATH, `error_${name}.log`),
      },
      {
        level: 'debug',
        path: path.join(env.LOGS_PATH, `debug_${name}.log`),
      },
      {
        level: 'debug',
        type: 'raw',
        stream: prettyStdOut,
      },
    ],
  });
  if (env.LOG_LEVEL) {
    logger.level(Bunyan[env.LOG_LEVEL]);
  }

  return logger;
}

export const Log = (logArgs: ILogArgs): ClassDecorator => target => {
  target.prototype.logName = logArgs.name;
  target.prototype.log = createEverLogger(logArgs);
};
