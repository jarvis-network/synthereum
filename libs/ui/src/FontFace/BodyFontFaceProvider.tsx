import React, { FC } from 'react';
import { Global, css } from '@emotion/core';

import { BodyFontFaceProviderProps, FontFaceMap } from './types';

export const BodyFontFaceProvider: FC<BodyFontFaceProviderProps> = ({
  children,
  font,
}) => {
  const FontFaceProvider = FontFaceMap[font];

  return (
    <>
      <FontFaceProvider />
      <Global
        styles={css`
          body {
            font-family: ${font};
          }
        `}
      />
      {children}
    </>
  );
};
