import React from 'react';

import { styled, ThemeSwitcher } from '../Theme';
import { Dropdown } from '../Dropdown';
import { AccountButton } from '../AccountButton';

import { Button } from '../Button';
import { RadioGroup } from '../Radio';

import { AccountDropdownProps } from './types';

const AccountDropdownContent = styled.div`
  box-sizing: border-box;
  width: 100%;
  padding: 13px 12px 12px;
  background: ${props => props.theme.background.primary};
  border: 1px solid ${props => props.theme.border.secondary};
  border-radius: ${props => props.theme.borderRadius.s};
  margin-top: 6px;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding-left: 32px;
    padding-right: 32px;
  }
`;

const CustomLink = styled(Button)`
  display: block;
  width: 100%;
  padding: 9px 12px;
  box-sizing: content-box;
  background: ${props => props.theme.background.primary};
  font-size: ${props => props.theme.font.sizes.m};
  margin-left: -12px;
  margin-right: -12px;
  border-bottom: 1px solid ${props => props.theme.border.secondary};
  line-height: 18px;
  font-family: Krub, sans-serif;
  border-radius: 0;

  &:first-child {
    border-top: 1px solid ${props => props.theme.border.secondary};
  }

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 16px 32px;
    margin-left: -32px;
    margin-right: -32px;
  }
`;

const Links = styled.div`
  margin-bottom: 12px;
  margin-top: 19px;
`;

const CustomRadioGroup = styled(RadioGroup)`
  margin-top: 15px;
  display: flex;
  justify-content: center;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 15px 0;
  }
`;

const Logout = styled(Button)`
  height: 30px;
  font-size: ${props => props.theme.font.sizes.s};
  padding: 0;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: 48px;
    font-size: 18px;
  }
`;

const defaultLinks = [
  {
    to: '/account',
    name: 'Account',
  },
  {
    to: '/help',
    name: 'Help',
  },
];

export const AccountDropdown: React.FC<AccountDropdownProps> = ({
  onLogout,
  onThemeChange,
  setExpanded,
  links = defaultLinks,
  position = 'static',
  className,
  width = '300px',
  isExpanded,
  ...props
}) => {
  const linksList = links.map(({ name, ...rest }) => {
    return (
      <CustomLink {...rest} key={name}>
        {name}
      </CustomLink>
    );
  });

  return (
    <Dropdown
      width={width}
      className={className}
      header={<AccountButton {...props} />}
      position={position}
      isExpanded={isExpanded}
      setExpanded={setExpanded}
    >
      <AccountDropdownContent>
        <ThemeSwitcher setTheme={onThemeChange} />
        <Links>{linksList}</Links>
        <Logout type="danger" onClick={onLogout} block>
          Log out
        </Logout>
      </AccountDropdownContent>
    </Dropdown>
  );
};
