import { ButtonSize } from '../Button/types';
import { DropdownProps } from '../Dropdown/types';

interface RouterLink {
  to: string;
  name: string;
}

interface ButtonLink {
  onClick: () => void;
  name: string;
}

export type MenuDropdownLink = RouterLink | ButtonLink;

export interface MenuDropdownProps
  extends Omit<DropdownProps, 'header' | 'children'> {
  items?: MenuDropdownLink[];
  size?: ButtonSize;
  header?: React.ReactNode;
  children?: React.ReactNode;
}
