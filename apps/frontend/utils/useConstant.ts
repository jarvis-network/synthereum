import { useState } from 'react';
export function useConstant<T>(value: T) {
  return useState(value)[0];
}
