import { Console } from 'console';
import { relative } from 'path';
const c = require('colors/safe');

export const console = new Console({
  colorMode: true,
  stdout: process.stdout,
  stderr: process.stderr,
});

const startTime = new Date().getTime();
let prevTime = startTime;

export function log(...args: any[]) {
  const info = getCallStackInfo();
  let loc = '';
  if (info) {
    const { path, line, col } = info;
    const relativePath = relative(process.cwd(), path);
    loc = `./${relativePath}:${line}:${col}`;
  }
  const now = new Date();
  const diff = ('+' + (now.getTime() - startTime).toString(10)).padStart(7);
  const diff2 = ('+' + (now.getTime() - prevTime).toString(10)).padStart(7);
  prevTime = now.getTime();
  const prefix =
    `[ ${c.gray(now.toISOString())} | Δt₀: ` +
    c.yellow(diff) +
    ` ms | Δtᵢ: ` +
    c.yellow(diff2) +
    ` ms | ${c.bgGray(loc)} ]: ${c.bold(args[0])}`;
  console.log(prefix, ...args.slice(1));
}

// https://v8.dev/docs/stack-trace-api
const callStackFmt = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/i;
const callStackFmt2 = /at\s+()(.*):(\d*):(\d*)/i;

export function getCallStackInfo(stackIndex: number = 0) {
  const callStack = new Error().stack?.split('\n').slice(3) ?? [];
  const callInfo = callStack[stackIndex];
  const matches = callStackFmt.exec(callInfo) ?? callStackFmt2.exec(callInfo);
  if (!matches || matches.length !== 5) return null;
  const path = matches[2];
  return {
    path,
    line: matches[3],
    col: matches[4],
    method: matches[1],
    callStack,
  };
}
