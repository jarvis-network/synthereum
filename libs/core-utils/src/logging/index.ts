import { Console } from 'console';
import { relative } from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const c = require('colors/safe');

const console =
  typeof process !== 'undefined'
    ? // Force stdout/stderr on Node.js
      new Console({
        colorMode: true,
        stdout: process.stdout,
        stderr: process.stderr,
      })
    : globalThis.console;

const { log: defaultLog, table, error } = console;

console.log = log;

export { log, error as logError, table as logTable };

const startTime = new Date().getTime();
let prevTime = startTime;

function log<Args extends unknown[]>(msg: string, ...args: Args): void {
  const info = getCallStackInfo();
  let loc = '';
  if (info) {
    const { path, line, col } = info;
    const relativePath = relative(process.cwd(), path);
    loc = `./${relativePath}:${line}:${col}`;
  }
  const now = new Date();
  const diff = `+${(now.getTime() - startTime).toString(10)}`.padStart(7);
  const diff2 = `+${(now.getTime() - prevTime).toString(10)}`.padStart(7);
  prevTime = now.getTime();
  const whitespace = info?.inConsoleClass === true ? '\n' : ' ';
  const prefix =
    `[ ${c.gray(now.toISOString())} | Δt₀: ${c.yellow(diff)} ms | ` +
    `Δtᵢ: ${c.yellow(diff2)} ms | ${c.bgGray(loc)} ]:` +
    `${whitespace}${c.bold(msg)}`;
  defaultLog(prefix, ...args);
}

export interface CallStackInfo {
  path: string;
  line: string;
  col: string;
  method: string;
  callStack: string[];
  inConsoleClass: boolean;
}

// https://v8.dev/docs/stack-trace-api
const callStackFmt = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/i;
const callStackFmt2 = /at\s+()(.*):(\d*):(\d*)/i;

export function getCallStackInfo(stackIndex = 0): CallStackInfo | null {
  /*
   * Node.js implementation details:
   * ErrorCaptureStackTrace JS binding: https://github.com/nodejs/node/blob/e46c680bf2b211bbd52cf959ca17ee98c7f657f5/deps/v8/src/builtins/builtins-definitions.h#L509
   * v8::internal::ErrorCaptureStackTrace implementation: https://github.com/nodejs/node/blob/e46c680bf2b211bbd52cf959ca17ee98c7f657f5/deps/v8/src/builtins/builtins-error.cc#L27
   * v8::internal::Isolate::CaptureAndSetDetailedStackTrace: https://github.com/nodejs/node/blob/f37c26b8a2e10d0a53a60a2fad5b0133ad33308a/deps/v8/src/execution/isolate.cc#L1151
   * v8::internal::Isolate::CaptureSimpleStackTrace https://github.com/nodejs/node/blob/f37c26b8a2e10d0a53a60a2fad5b0133ad33308a/deps/v8/src/execution/isolate.cc#L1134
   */

  const callStack = new Error().stack?.split('\n') ?? [];
  const inConsoleClass =
    callStack[3]?.indexOf('internal/console') >= 0 ?? false;
  const offset = inConsoleClass ? 5 : 3;
  const userCallStack = callStack.slice(offset);
  const callInfo = userCallStack[stackIndex];
  const matches = callStackFmt.exec(callInfo) ?? callStackFmt2.exec(callInfo);
  if (!matches || matches.length !== 5) return null;
  const path = matches[2];
  return {
    path,
    line: matches[3],
    col: matches[4],
    method: matches[1],
    callStack: userCallStack,
    inConsoleClass,
  };
}
