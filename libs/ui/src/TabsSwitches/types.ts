import { ReactNode } from 'react';

import { FontSizeType } from '../Theme';

export interface Tab {
  title: string;
  content?: ReactNode;
}

export interface TabsProps {
  selected?: number;
  onChange?: (index: number) => void;
  tabs: Tab[];
  pointer?: boolean;
  pre?: ReactNode;
  extra?: ReactNode;
  pointerPosition?: string;
  titleFontSize?: FontSizeType;
  layout?: 'TOP-BOTTOM' | 'BOTTOM-TOP';
}
