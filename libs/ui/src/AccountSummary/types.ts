import { MenuDropdownLink } from '../MenuDropdown';
import { ThemeNameType } from '../Theme';

export enum AccountMode {
  demo,
  real,
}

export type AccountModeType = keyof typeof AccountMode;

export interface AccountSummaryProps {
  // auth
  wallet?: string;
  name?: string;
  image?: string;

  // actions
  menu?: MenuDropdownLink[];
  mode?: AccountModeType;

  // handlers
  onLogin?: () => void;
  onLogout?: () => void;
  onThemeChange?: (theme: ThemeNameType) => void;
  onHelp?: () => void;

  // customization
  className?: string;
  contentOnTop?: boolean;
  authLabel?: string;
}
