import React from 'react';
import { boolean, text, number } from '@storybook/addon-knobs';

import { AssetsRow } from '..';

export default {
  title: 'AssetsRow/AssetsRow',
  component: AssetsRow,
};

export const Default = () => (
  <AssetsRow
    from={{
      image: 'https://is.gd/avataravatar',
      name: 'jEUR',
      value: -2,
    }}
    to={{
      image: 'https://is.gd/avataravatar110',
      name: 'USDC',
      value: 2.72,
    }}
  />
);

export const Flag = () => (
  <AssetsRow
    from={{
      flag: 'eur',
      name: 'jEUR',
      value: -2,
    }}
    to={{
      flag: 'us',
      name: 'USDC',
      value: 2.72,
    }}
  />
);

export const Knobs = () => {
  const isOpen = boolean('Is open', false);
  const assetFromImage = text('AssetFrom image', 'https://is.gd/avataravatar');
  const assetFromName = text('AssetFrom name', 'jEUR');
  const assetFromValue = number('AssetFrom value', -2);
  const assetToImage = text('AssetTo image', 'https://is.gd/avataravatar110');
  const assetToName = text('AssetTo name', 'USDC');
  const assetToValue = number('AssetTo value', 2.72);

  return (
    <AssetsRow
      isOpen={isOpen}
      from={{
        image: assetFromImage,
        name: assetFromName,
        value: assetFromValue,
      }}
      to={{
        image: assetToImage,
        name: assetToName,
        value: assetToValue,
      }}
    />
  );
};
