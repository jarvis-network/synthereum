import React from 'react';

import { styled } from '../Theme';
import { flexRow } from '../common/mixins';

import { DescriptionsProps } from './types';

const Container = styled.div<{ isGrid: boolean }>`
  ${flexRow()}
  width: 100%;
  flex-wrap: wrap;
`;

export const Descriptions: React.FC<DescriptionsProps> = ({
  children,
  isGrid = false,
}) => <Container isGrid={isGrid}>{children}</Container>;
