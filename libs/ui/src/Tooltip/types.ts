import { CSSProperties, ReactNode } from 'react';

export enum TooltipPosition {
  top,
  right,
  bottom,
  left,
}

export type TooltipPositionType = keyof typeof TooltipPosition;

export interface TooltipProps {
  children?: ReactNode;
  tooltip?: string | ReactNode;
  position?: TooltipPositionType;
  width?: CSSProperties['width'];
}
