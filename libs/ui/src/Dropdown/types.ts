import { CSSProperties, ReactNode } from 'react';

export type Position = 'static' | 'absolute';

export interface DropdownProps {
  className?: string;
  style?: CSSProperties;
  width?: CSSProperties['width'];
  header: ReactNode;
  children: ReactNode;
  blockOutsideCollapse?: boolean;
  isExpanded?: boolean;
  setExpanded?: (isOpen: boolean) => void;
  useBoxShadow?: boolean;
  useBorder?: boolean;
  position?: Position;
  contentOnTop?: boolean;
}
