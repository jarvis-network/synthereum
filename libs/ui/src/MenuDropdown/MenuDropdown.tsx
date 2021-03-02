import React, { FC } from 'react';

import { Dropdown } from '../Dropdown';
import { IconButton } from '../IconButton';
import { styled } from '../Theme';
import { Button } from '../Button';

import { MenuDropdownProps } from './types';

const CustomDropdown = styled(Dropdown)`
  background: transparent;
  box-shadow: none;

  .dropdown-content {
    left: auto !important;
  }
`;

const Content = styled.div<{ contentOnTop?: boolean }>`
  border: 1px solid ${props => props.theme.border.secondary};
  border-radius: ${props => props.theme.borderRadius.s};
  background: ${props => props.theme.background.primary};
  padding: 5px 0;
  width: 100%;

  ${props =>
    props.contentOnTop
      ? `
    margin-bottom: 10px;
  `
      : `
    margin-top: 10px;
  `}
`;

const CustomIconButton = styled(IconButton)`
  border-radius: ${props => props.theme.borderRadius.s};
  background: ${props => props.theme.background.primary};
`;

const CustomButton = styled(Button)`
  text-align: left;
  display: inline-block;
`;

export const MenuDropdown: FC<MenuDropdownProps> = ({
  items,
  size = 'm',
  contentOnTop = false,
  header,
  children,
  ...props
}) => {
  const headerElem = header ?? (
    <CustomIconButton size={size} icon="BsThreeDots" />
  );

  return (
    <CustomDropdown {...props} contentOnTop={contentOnTop} header={headerElem}>
      <Content contentOnTop={contentOnTop}>
        {items?.map(item => (
          <CustomButton {...item} size="s" block type="transparent">
            {item.name}
          </CustomButton>
        ))}
        {children}
      </Content>
    </CustomDropdown>
  );
};
