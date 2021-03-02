import React from 'react';

import { MenuItemProps } from '../types';

import { Label } from '../../Label';

export const MenuItem: React.FC<MenuItemProps> = ({
  label,
  link,
  routerLink: RouterLink,
  customMenuRender: CustomMenuRender,
  ...props
}) =>
  CustomMenuRender ? (
    <CustomMenuRender />
  ) : (
    <RouterLink {...props} key={label} to={link}>
      <Label>{label}</Label>
    </RouterLink>
  );
