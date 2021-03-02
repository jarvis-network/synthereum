import React from 'react';

import { FontFaceMap, FontFace } from '../types';

import { BodyFontFaceProvider } from '..';

export default {
  title: 'common/FontFace',
  component: BodyFontFaceProvider,
};

export const NoFontFace = () => (
  <p>
    “Live as if you were to die tomorrow. Learn as if you were to live forever.”
  </p>
);

export const LocalFontFaceKrub = () => {
  const InjectFontFace = FontFaceMap[FontFace.KRUB];

  return (
    <div>
      <InjectFontFace />
      <p>“Without music, life would be a mistake.”</p>
      <p style={{ fontFamily: FontFace.KRUB }}>
        “Without music, life would be a mistake.”
      </p>
    </div>
  );
};
