import React from 'react';

import { styled } from '../Theme';
import { flexRow } from '../common/mixins';

import { DescriptionsItemProps } from './types';

const Row = styled.div<{ isGrid: boolean }>`
  ${flexRow()}
  align-items: center;
  justify-content: space-between;
  font-size: ${props => props.theme.font.sizes.s};
  margin: 8px 0;

  ${props =>
    props.isGrid
      ? `
    width: 50%;
    padding: 0 15px;
    box-sizing: border-box;
  `
      : `

      width: 100%;
      `};
`;

const Label = styled.div<{ isGrid: boolean }>`
  width: 50%;
  color: ${props => props.theme.text.secondary};
`;

const Value = styled(Label)`
  color: ${props => props.theme.text.medium};
  text-align: ${props => (props.isGrid ? 'left' : 'right')};
`;

export const DescriptionsItem: React.FC<DescriptionsItemProps> = ({
  label,
  children,
  isGrid = false,
}) => (
  <Row isGrid={isGrid}>
    <Label isGrid={isGrid}>{label}</Label>
    <Value isGrid={isGrid}>{children}</Value>
  </Row>
);
