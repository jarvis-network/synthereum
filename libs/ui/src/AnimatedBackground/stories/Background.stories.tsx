import React from 'react';
import { number, boolean, select, color } from '@storybook/addon-knobs';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';
import { addParameters } from '@storybook/react';
import { SizeMe } from 'react-sizeme';

import { AnimatedBackground, BackgroundProvider } from '..';

import { images } from './assets';

const isChromatic =
  window.navigator.userAgent.match(/Chromatic/) ||
  window.location.href.match(/chromatic=true/);

addParameters({
  viewport: {
    viewports: INITIAL_VIEWPORTS,
  },
});

export default {
  title: 'background/AnimatedBackground',
  component: AnimatedBackground,
};

export const Default = () => (
  <AnimatedBackground url={images['./desert_background.svg']} />
);

export const BackgroundWithAnimation = () => (
  <BackgroundProvider>
    <AnimatedBackground
      url={images['./desert_background.svg']}
      offset="30%"
      animate={!isChromatic}
    />
  </BackgroundProvider>
);

export const BackgroundWithAnimationAndColor = () => (
  <BackgroundProvider>
    <AnimatedBackground
      url={images['./desert_background.svg']}
      offset="30%"
      bgColor="#000000"
      animate={!isChromatic}
    />
  </BackgroundProvider>
);

export const BackgroundWithAnimationColorAndChildren = () => {
  const centerContent = boolean('Center content', true);
  return (
    <BackgroundProvider>
      <AnimatedBackground
        url={images['./desert_background.svg']}
        offset="30%"
        bgColor="#000000"
        centerContent={centerContent}
        animate={!isChromatic}
      >
        <div style={{ color: 'blue' }}>[child #1]</div>
        <div style={{ color: 'red' }}>[child #2]</div>
      </AnimatedBackground>
    </BackgroundProvider>
  );
};

export const Knobs = () => {
  const offset = number('Background offset (in %)', 0, {
    range: true,
    min: 0,
    max: 100,
  });
  const bgColor = color('Background color', '#F8E71C');
  const animate = boolean('Animate', true);
  const centerContent = boolean('Center content', true);
  type Options = Parameters<typeof AnimatedBackground>[0]['updateHeight'];
  const updateHeight = select<Options>(
    'Update height when?',
    ['on-mount-only', 'on-resize', 'fixed-100vh'],
    'on-mount-only',
  );

  return (
    <BackgroundProvider>
      <AnimatedBackground
        bgColor={bgColor}
        url={images['./desert_background.svg']}
        offset={`${offset}%`}
        animate={!isChromatic && animate}
        centerContent={centerContent}
        updateHeight={updateHeight}
      >
        <SizeMe
          monitorWidth={false}
          monitorHeight
          refreshMode="throttle"
          refreshRate={64}
        >
          {({ size }) => <span>height: {size?.height?.toFixed(0)}px</span>}
        </SizeMe>
      </AnimatedBackground>
    </BackgroundProvider>
  );
};
