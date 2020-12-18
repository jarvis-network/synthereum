import { assert } from './asserts';

export const range = (start: number, end: number, step: number) => {
  return start < end
    ? ascendingRange(start, end, step)
    : descendingRange(start, end, step);
};

export const ascendingRange = (start: number, end: number, step: number) => {
  assert(start < end && step > 0);
  return {
    *[Symbol.iterator]() {
      for (let i = start; i < end; i += step) {
        yield i;
      }
    },
  };
};

export const descendingRange = (start: number, end: number, step: number) => {
  assert(end < start && step > 0);
  return {
    *[Symbol.iterator]() {
      for (let i = start; end < i; i -= step) {
        yield i;
      }
    },
  };
};
