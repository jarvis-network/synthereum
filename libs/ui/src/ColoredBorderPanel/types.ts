import { ReactNode } from 'react';

import { ligthTheme } from '../Theme/themes';

export enum SizeConfig {
  large = 36,
  normal = 24,
  small = 12,
}

export type Size = keyof typeof SizeConfig;

export type Color = keyof typeof ligthTheme.common;

export interface ColoredBorderPanelProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  size?: Size;
  color?: Color;
}
