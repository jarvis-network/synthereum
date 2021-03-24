import React from 'react';
import { boolean, select } from '@storybook/addon-knobs';

import { ligthTheme } from '../../Theme/themes';
import { styled } from '../../Theme';

import { ColoredBorderPanel } from '..';

import { sizeList, colorList } from './data';

export default {
  title: 'ColoredBorderPanel',
  component: ColoredBorderPanel,
};

export const Default = () => (
  <ColoredBorderPanel>
    <p>Hi! I am simple Colored-border Panel component.</p>
    <p>
      Now you see the simplest usage of me: without any customization and with
      theme default border color.
    </p>
    <p>See other examples and learn how can you use me for your needs.</p>
  </ColoredBorderPanel>
);

export const WithHeader = () => (
  <ColoredBorderPanel header={<strong>I am the header</strong>}>
    <p>Example with header.</p>
    <p>
      As <code>header</code> might be passed any ReactNode.
    </p>
  </ColoredBorderPanel>
);

export const WithFooter = () => (
  <ColoredBorderPanel footer={<em>I am the footer</em>}>
    <p>Example with footer.</p>
    <p>
      Same as header, <code>footer</code> accepts any ReactNode.
    </p>
  </ColoredBorderPanel>
);

export const Size = () => {
  const size = select('Size', sizeList, sizeList[1]);

  return (
    <ColoredBorderPanel
      size={size}
      header={<strong>Header</strong>}
      footer={<em>I am the footer</em>}
    >
      <code>size</code> prop accepts three values: <code>large</code>,{' '}
      <code>normal</code> (is default) and <code>small</code>.
    </ColoredBorderPanel>
  );
};

export const Color = () => {
  const color = select('Color', colorList, colorList[0]);

  return (
    <ColoredBorderPanel
      color={color}
      header={<strong>Header</strong>}
      footer={<em>I am the footer</em>}
    >
      <code>color</code> prop accepts theme <code>common</code> section colors:{' '}
      <code>{Object.keys(ligthTheme.common).toString()}</code>.
    </ColoredBorderPanel>
  );
};

export const Knobs = () => {
  const headerEnabled = boolean('Header enabled', false);
  const footerEnabled = boolean('Footer enabled', false);
  const size = select('Size', sizeList, sizeList[1]);
  const color = select('Color', colorList, colorList[0]);

  return (
    <ColoredBorderPanel
      color={color}
      size={size}
      header={headerEnabled && <strong>Header</strong>}
      footer={footerEnabled && <em>Footer</em>}
    >
      <ul>
        <li>
          headerEnabled = <code>{String(headerEnabled)}</code>
        </li>
        <li>
          footerEnabled = <code>{String(footerEnabled)}</code>
        </li>
        <li>
          size = <code>{size}</code>
        </li>
        <li>
          color = <code>{color}</code>
        </li>
      </ul>
    </ColoredBorderPanel>
  );
};

const RowItem = styled.div`
  display: inline-block;
  width: 150px;
  height: 150px;
  margin: 10px;
`;

export const SmallInline = () => (
  <>
    <RowItem>
      <ColoredBorderPanel color="success" size="small">
        First
      </ColoredBorderPanel>
    </RowItem>
    <RowItem>
      <ColoredBorderPanel color="success" size="small">
        Second
      </ColoredBorderPanel>
    </RowItem>
    <RowItem>
      <ColoredBorderPanel color="success" size="small">
        Third
      </ColoredBorderPanel>
    </RowItem>
  </>
);
