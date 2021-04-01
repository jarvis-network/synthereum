import { assert } from './asserts';

export function range(
  start: number,
  end: number,
  step: number,
): Iterable<number> {
  return start < end
    ? ascendingRange(start, end, step)
    : descendingRange(start, end, step);
}

export function ascendingRange(
  start: number,
  end: number,
  step: number,
): Iterable<number> {
  assert(start < end && step > 0);
  return {
    *[Symbol.iterator]() {
      for (let i = start; i < end; i += step) {
        yield i;
      }
    },
  };
}

export function descendingRange(
  start: number,
  end: number,
  step: number,
): Iterable<number> {
  assert(end < start && step > 0);
  return {
    *[Symbol.iterator]() {
      for (let i = start; end < i; i -= step) {
        yield i;
      }
    },
  };
}
