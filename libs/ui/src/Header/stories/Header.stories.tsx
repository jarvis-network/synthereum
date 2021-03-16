import React from 'react';
import { Link } from 'react-router-dom';
import { action } from '@storybook/addon-actions';

import { Label } from '../../Label';
import { styled } from '../../Theme';

import { Header } from '..';

import { images } from './assets';

export default {
  title: 'Header',
  component: Header,
};

const defaultMenu = [{ label: 'Account', link: '#' }];

const defaultActionButtons = [
  {
    title: 'Login to Trade',
    onClick: () => {
      action('login button clicked.');
    },
  },
  {
    title: 'Help',
    onClick: () => {
      action('help button clicked.');
    },
  },
];

const StyledLink = styled(Link)`
  color: ${props => props.theme.text.primary};
`;

export const Default = () => (
  <Header
    logoUrl={images['./logo.png']}
    link={StyledLink}
    leftSide={{ menu: defaultMenu }}
    rightSide={{ actionButtons: defaultActionButtons }}
  />
);

export const CustomHeader = () => (
  <Header render={() => <Label>I am a custom Header</Label>} />
);

const UglyHeader = styled(Header)`
  background: red;
`;

export const WithCustomStyles = () => (
  <UglyHeader render={() => <Label>I am a custom Header</Label>} />
);
