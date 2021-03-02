import { CSSProperties } from 'react';

import { AccountButtonProps } from '../AccountButton/types';
import { Position } from '../Dropdown/types';
import { ThemeNameType } from '../Theme/types';

interface RouterLink {
  to: string;
  name: string;
}

interface ButtonLink {
  onClick: () => void;
  name: string;
}

type Link = RouterLink | ButtonLink;

export interface AccountDropdownProps
  extends Omit<AccountButtonProps, 'onClick'> {
  width?: CSSProperties['width'];
  className?: string;
  onLogout: () => void;
  onThemeChange: (theme: ThemeNameType) => void;
  links?: Link[];
  position?: Position;
  isExpanded?: boolean;
  setExpanded?: (value: boolean) => void;
}
