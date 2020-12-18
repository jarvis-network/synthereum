import {
  assertIsString,
  throwError,
} from '@jarvis-network/web3-utils/base/asserts';
import { typeCheck } from '@jarvis-network/web3-utils/base/meta';
import * as Bunyan from 'bunyan';
import PrettyStream from 'bunyan-prettystream';
import { existsSync } from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
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
export type LogLevels = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'FATAL' | 'TRACE';
const supportedLevels = typeCheck<LogLevels[]>()([
  'INFO',
  'DEBUG',
  'WARN',
  'ERROR',
  'FATAL',
  'TRACE',
] as const);

export function parseLogLevel(x: unknown): LogLevels {
  const levelName = assertIsString(x);
  const supported = supportedLevels as readonly string[];
  return supported.findIndex(s => levelName === s) !== -1
    ? (levelName as LogLevels)
    : throwError(
        `${x} is not supported. Supported level ids are: ` + `[${supported}]`,
      );
}
