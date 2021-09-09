import { ImgHTMLAttributes } from 'react';

export type Size = 'small' | 'medium' | 'big';

export interface FlagProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  flag?: string;
  size?: Size;
}
