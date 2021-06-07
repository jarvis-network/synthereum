import { useEffect, useMemo, useState } from 'react';

/**
 * This hook will only change the value given in the first argument after it settles for X seconds
 */
export function useDebouncedValue<T>(value: T, timeout = 300): T {
  const [counter, setCounter] = useState(0);
  const lastValue = useMemo(() => value, [counter]);

  useEffect(() => {
    if (lastValue === value) return;

    const id = setTimeout(() => setCounter(state => state + 1), timeout);

    return () => clearTimeout(id);
  }, [lastValue, value, timeout, setCounter]);

  return lastValue;
}
