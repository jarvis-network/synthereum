import React, { FC } from 'react';

import { Dropdown } from '../Dropdown';
import { IconButton } from '../IconButton';
import { styled } from '../Theme';

import { IconsDropdownProps } from './types';

const CustomDropdown = styled(Dropdown)`
  background: transparent;
  box-shadow: none;
`;

const Content = styled.div<{ contentOnTop?: boolean }>`
  border: 1px solid ${props => props.theme.border.secondary};
  border-radius: ${props => props.theme.borderRadius.s};
  background: ${props => props.theme.background.primary};

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

export const IconsDropdown: FC<IconsDropdownProps> = ({
  items,
  active = 0,
  size = 'm',
  contentOnTop = false,
  ...props
}) => {
  if (!items.length) {
    return null;
  }

  return (
    <CustomDropdown
      {...props}
      contentOnTop={contentOnTop}
      header={<CustomIconButton size={size} icon={items[active].icon} />}
      width="35px"
    >
      <Content contentOnTop={contentOnTop}>
        {items.map(({ icon, onClick }) => (
          <CustomIconButton
            key={icon}
            size={size}
            icon={icon}
            onClick={onClick}
          />
        ))}
      </Content>
    </CustomDropdown>
  );
};
