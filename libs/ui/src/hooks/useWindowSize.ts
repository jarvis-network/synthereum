import { useState, useLayoutEffect } from 'react';

type WindowSize = {
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
};

const SSR_DIMENSIONS: WindowSize = {
  innerWidth: 1280,
  innerHeight: 720,
  outerWidth: 1280,
  outerHeight: 720,
};

export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState(getWindowSize);
  function update() {
    setWindowSize(getWindowSize());
  }
  useLayoutEffect(() => {
    if (typeof window !== 'object') {
      return () => null;
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return windowSize;
}

function getWindowSize() {
  if (typeof window !== 'object') {
    return SSR_DIMENSIONS;
  }

  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
  };
}
