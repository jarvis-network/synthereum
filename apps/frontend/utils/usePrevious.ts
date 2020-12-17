import { useEffect, useRef } from 'react';

export const usePrevious = <T = any>(value: T) => {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
};
