import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

(() => {
  const err = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].startsWith('A non-serializable value was detected in') &&
      args[1] instanceof FPN
    ) {
      return;
    }
    err(...args);
  };
})();

export {};
