import React, { FC, useState } from 'react';

import { AccountButton } from '../AccountButton';
import { Button } from '../Button';
import { flexRow } from '../common/mixins';
import { IconsDropdown, IconsDropdownItem } from '../IconsDropdown';
import { MenuDropdown } from '../MenuDropdown';
import { styled, ThemeNameType, useTheme } from '../Theme';
import { IconButton } from '../IconButton';

import { AccountSummaryProps, AccountModeType } from './types';

function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

const Container = styled.div`
  ${flexRow()}
  height: 38px;
`;

const Item = styled.div<{ width: string }>`
  width: ${props => props.width};
  margin-left: 10px;
  border: 1px solid ${props => props.theme.border.secondary};
  border-radius: ${props => props.theme.borderRadius.s};
  background: ${props => props.theme.background.primary};

  :first-child {
    margin-left: 0;
  }
`;

const Mode = styled.div<{ mode: AccountModeType }>`
  padding: 0 14px;
  border-radius: ${props => props.theme.borderRadius.s};
  font-size: ${props => props.theme.font.sizes.l};
  height: 38px;
  line-height: 38px;
  box-sizing: border-box;

  ${props =>
    props.mode === 'real'
      ? `
    color: ${props.theme.tooltip.text};
    background: ${props.theme.tooltip.secondaryBackground};
  `
      : `
    color: ${props.theme.text.secondary};
    background: ${props.theme.background.secondary};
  `}

  :before {
    content: '${props => capitalize(props.mode)}';
  }

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    :before {
      content: '${props => capitalize(props.mode[0])}';
    }
  }
`;

const CustomAccountButton = styled(AccountButton)`
  border: none;
  font-size: ${props => props.theme.font.sizes.l};
`;

const FullHeightButton = styled(Button)`
  height: 100%;
  line-height: 100%;
  font-weight: 300;
  font-size: ${props => props.theme.font.sizes.l};
`;

const FullWidthMenuDropdown = styled(MenuDropdown)`
  .dropdown-content {
    width: 100%;
    min-width: 120px;

    button {
      width: calc(100% - 20px) !important;
      margin: 0 10px !important;
      text-align: center;
    }
  }
`;

const CustomIconButton = styled(IconButton)`
  border-radius: ${props => props.theme.borderRadius.s};
  background: ${props => props.theme.background.primary};
  padding: 0;
  i {
    width: 100%;
  }
  svg {
    width: 18px;
    height: 18px;
  }
`;

export const AccountSummary: FC<AccountSummaryProps> = ({
  mode,
  name,
  wallet,
  image,
  menu,
  onLogin,
  onLogout,
  onHelp,
  onThemeChange,
  contentOnTop = false,
  authLabel = 'Sign in',
}) => {
  const { name: theme } = useTheme();

  const [isMenuVisible, setStateMenuVisible] = useState(false);
  const [isThemeSwitcherVisible, setThemeSwitcherVisible] = useState(false);

  const setMenuVisible = (state: boolean) => {
    if (!wallet) {
      return;
    }
    setStateMenuVisible(state);
  };

  const handleThemeChange = (newTheme: ThemeNameType) => {
    if (!onThemeChange) {
      return;
    }

    setThemeSwitcherVisible(false);
    onThemeChange(newTheme);
  };

  const menuItems = menu
    ? menu.map(item => {
        if ('onClick' in item) {
          return {
            ...item,
            onClick: () => {
              item.onClick();
              setMenuVisible(false);
            },
          };
        }

        return item;
      })
    : undefined;

  const handleLogout = () => {
    setMenuVisible(false);
    onLogout?.();
  };

  const themes:
    | (IconsDropdownItem & { theme: ThemeNameType })[]
    | null = onThemeChange
    ? [
        {
          theme: 'light',
          icon: 'IoIosSunny',
          onClick: () => handleThemeChange('light'),
        },
        {
          theme: 'night',
          icon: 'IoIosCloudyNight',
          onClick: () => handleThemeChange('night'),
        },
        {
          theme: 'dark',
          icon: 'IoIosMoon',
          onClick: () => handleThemeChange('dark'),
        },
      ]
    : null;

  const auth = wallet ? (
    <CustomAccountButton image={image} name={name} wallet={wallet} />
  ) : (
    <FullHeightButton onClick={onLogin} block size="m" type="transparent">
      {authLabel}
    </FullHeightButton>
  );

  return (
    <Container>
      {mode && <Mode mode={mode} />}

      <Item width="100%">
        <FullWidthMenuDropdown
          size="s"
          position="absolute"
          contentOnTop={contentOnTop || false}
          items={menuItems}
          header={auth}
          isExpanded={isMenuVisible}
          setExpanded={setMenuVisible}
        >
          <Button size="s" type="danger" onClick={handleLogout}>
            Sign out
          </Button>
        </FullWidthMenuDropdown>
      </Item>

      {themes && (
        <Item width="35px">
          <IconsDropdown
            size="s"
            position="absolute"
            contentOnTop={contentOnTop || false}
            active={themes.findIndex(i => i.theme === theme)}
            items={themes}
            isExpanded={isThemeSwitcherVisible}
            setExpanded={setThemeSwitcherVisible}
          />
        </Item>
      )}

      {onHelp && (
        <Item width="35px">
          <CustomIconButton icon="BsQuestion" size="s" onClick={onHelp} />
        </Item>
      )}
    </Container>
  );
};
