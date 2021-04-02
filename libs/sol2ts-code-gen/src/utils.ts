/* eslint-disable no-console */

export async function execTask(
  msg: string,
  task: () => Promise<void | void[]>,
): Promise<void> {
  logSeparate(msg);
  await task();
  console.log('DONE');
}

export function logSeparate(msg: string): void {
  console.log(`-------------------\n${msg}`);
}
