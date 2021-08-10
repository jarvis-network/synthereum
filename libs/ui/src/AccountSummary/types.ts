import { MenuDropdownLink } from '../MenuDropdown';
import { ThemeNameType } from '../Theme';

export interface AccountSummaryProps {
  // auth
  wallet?: string;
  name?: string;
  image?: string;

  // actions
  menu?: MenuDropdownLink[];
  network?: string;

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
