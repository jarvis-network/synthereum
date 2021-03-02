import { ButtonSize } from '../Button/types';
import { DropdownProps } from '../Dropdown/types';
import { IconKeys } from '../Icon/Icon';

export interface IconsDropdownItem {
  onClick: () => void;
  icon: IconKeys;
}

export interface IconsDropdownProps
  extends Omit<DropdownProps, 'header' | 'children'> {
  size?: ButtonSize;
  active?: number;
  items: IconsDropdownItem[];
}
