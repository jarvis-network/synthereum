import { useState } from 'react';

export function useConstant<T>(value: T | (() => T)): T {
  return useState(value)[0];
}
