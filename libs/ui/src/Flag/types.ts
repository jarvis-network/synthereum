import { ImgHTMLAttributes } from 'react';

import { FlagKeys } from './files';

export type Size = 'small' | 'medium' | 'big';

export interface FlagProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  flag: FlagKeys;
  size?: Size;
}
