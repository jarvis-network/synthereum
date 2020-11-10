import { Icon, styled } from '@jarvis-network/ui';
import React, { MouseEvent } from 'react';

const Container = styled.button`
  position: relative;
  margin-left: 3px;
  display: inline-block;
  vertical-align: middle;
  height: 13px;
  width: 13px;
  padding: 0;
  border: none;
  cursor: pointer;
  outline: none !important;
  background: none;

  i {
    color: ${props => props.theme.text.secondary}!important;
    position: absolute;
    left: 0;

    &:first-child {
      top: -3px;
    }
    &:last-child {
      top: 2px;
    }
  }
`;

interface Props {
  onClick: (event: MouseEvent) => void;
}

export const ExchangeRateIcon: React.FC<Props> = ({ onClick }) => {
  return (
    <Container onClick={onClick}>
      <Icon icon="BsArrowLeft" />
      <Icon icon="BsArrowRight" />
    </Container>
  );
};
