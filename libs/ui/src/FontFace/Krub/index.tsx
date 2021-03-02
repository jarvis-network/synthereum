import React, { FC } from 'react';
import { Global, css } from '@emotion/core';

import Bold from './Krub-Bold.ttf';
import BoldItalic from './Krub-BoldItalic.ttf';
import ExtraLight from './Krub-ExtraLight.ttf';
import ExtraLightItalic from './Krub-ExtraLightItalic.ttf';
import Italic from './Krub-Italic.ttf';
import Light from './Krub-Light.ttf';
import LightItalic from './Krub-LightItalic.ttf';
import Medium from './Krub-Medium.ttf';
import MediumItalic from './Krub-MediumItalic.ttf';
import Regular from './Krub-Regular.ttf';
import SemiBold from './Krub-SemiBold.ttf';
import SemiBoldItalic from './Krub-SemiBoldItalic.ttf';

export const InjectKrubFontFace: FC = () => (
  <Global
    styles={css`
      @font-face {
        font-family: 'Krub';
        font-weight: 200;
        src: url('${ExtraLight}');
      }
    
      @font-face {
        font-family: 'Krub';
        font-style: italic;
        font-weight: 200;
        src: url('${ExtraLightItalic}');
      }
    
      // Light
    
      @font-face {
        font-family: 'Krub';
        font-weight: 300;
        src: url('${Light}');
      }
    
      @font-face {
        font-family: 'Krub';
        font-style: italic;
        font-weight: 300;
        src: url('${LightItalic}');
      }
    
      // Regular
    
      @font-face {
        font-family: 'Krub';
        src: url('${Regular}');
      }
    
      @font-face {
        font-family: 'Krub';
        font-style: italic;
        src: url('${Italic}');
      }
    
      // Medium
    
      @font-face {
        font-family: 'Krub';
        font-weight: 500;
        src: url('${Medium}');
      }
    
      @font-face {
        font-family: 'Krub';
        font-style: italic;
        font-weight: 500;
        src: url('${MediumItalic}');
      }
    
      // Semi bold
    
      @font-face {
        font-family: 'Krub';
        font-weight: 600;
        src: url('${SemiBold});
      }
    
      @font-face {
        font-family: 'Krub';
        font-style: italic;
        font-weight: 600;
        src: url('${SemiBoldItalic}');
      }
    
      // Bold
    
      @font-face {
        font-family: 'Krub';
        font-weight: 700;
        src: url('${Bold}');
      }
    
      @font-face {
        font-family: 'Krub';
        font-style: italic;
        font-weight: 700;
        src: url('${BoldItalic}');
      }
    `}
  />
);
