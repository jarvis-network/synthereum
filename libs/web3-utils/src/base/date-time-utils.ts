import { SortedArray } from './sorting';

export function findElementWithClosestTimestamp<T>(
  array: T[],
  date: Date,
  getTimestamp: (x: T) => Date,
  lastFractionalHack = false,
): [number, T?] {
  if (!array.length) return [-1, undefined];
  const sorted = sortByDate(array, getTimestamp);
  let idx;
  if (lastFractionalHack && isDateOnly(date)) {
    // if time is not specified, get the last snapshot of the day
    idx = sorted.lowerBound(addDays(date, 1).getTime());
    // Switch to the previous element, if we're not at the first one.
    if (idx > 0) idx--;
  } else {
    idx = sorted.closestValue(date.getTime());
  }
  return [idx, array[idx]];
}

export function sortByDate<T>(array: T[], extractDate: (x: T) => Date) {
  return SortedArray.createFromUnsorted(
    array,
    (a, b) => extractDate(a).getTime() - extractDate(b).getTime(),
    x => extractDate(x).getTime(),
  );
}

export function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

export function addSeconds(date: Date, seconds: number): Date {
  return addMilliseconds(date, seconds * 1000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return addSeconds(date, minutes * 60);
}

export function addHours(date: Date, hours: number): Date {
  return addMinutes(date, hours * 60);
}

export function addDays(date: Date, days: number): Date {
  return addHours(date, days * 24);
}

// Returns true if the time component of this Date object is not set (all zeroes).
export function isDateOnly(date: Date): boolean {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}
