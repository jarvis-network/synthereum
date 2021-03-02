import { ReactNode } from 'react';

import { InjectKrubFontFace } from './Krub';

export enum FontFace {
  KRUB = '"Krub", sans-serif',
}

export const FontFaceMap = {
  [FontFace.KRUB]: InjectKrubFontFace,
} as const;

export interface BodyFontFaceProviderProps {
  font: FontFace;
  children: ReactNode;
}
