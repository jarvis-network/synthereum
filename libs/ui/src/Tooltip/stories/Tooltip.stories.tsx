import React from 'react';
import { select } from '@storybook/addon-knobs';

import { positionList, widthList } from '../stories/data';

import { styled, ThemeProvider } from '../../Theme';
import { flexRow } from '../../common/mixins';

import { Tooltip } from '..';

export default {
  title: 'Tooltip',
  component: Tooltip,
};

const Wrapper = styled.div`
  ${flexRow()}
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 200px;
`;

const TooltipContent = () => (
  <span>
    The amount of money used to collateralize the amount of money used to
    collateralize.
  </span>
);
const TooltipComponent = () => <div>Hover on me</div>;

export const Default = () => {
  return (
    <ThemeProvider theme="light">
      <Wrapper>
        <Tooltip tooltip={<TooltipContent />} position="right">
          <TooltipComponent />
        </Tooltip>
      </Wrapper>
    </ThemeProvider>
  );
};

export const CustomWidth = () => {
  return (
    <ThemeProvider theme="light">
      <Wrapper>
        <Tooltip tooltip={<TooltipContent />} position="right" width="300px">
          <TooltipComponent />
        </Tooltip>
      </Wrapper>
    </ThemeProvider>
  );
};
export const Knobs = () => {
  const position = select('Position', positionList, positionList[0]);
  const width = select('Width', widthList, widthList[0]);

  return (
    <ThemeProvider theme="light">
      <Wrapper>
        <Tooltip tooltip={<TooltipContent />} position={position} width={width}>
          <TooltipComponent />
        </Tooltip>
      </Wrapper>
    </ThemeProvider>
  );
};
