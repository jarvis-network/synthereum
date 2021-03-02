import React from 'react';

import { styled } from '../Theme';
import { flexColumn, flexRow } from '../common/mixins';

import { AccountButtonProps } from './types';
import defaultImage from './assets/no-image.png';

const Container = styled.button`
  ${flexRow()}
  justify-content: flex-start;
  align-items: center;
  padding: 2px 7px;
  border: 1px solid ${props => props.theme.border.secondary};
  background: ${props => props.theme.background.primary};
  text-align: left;
  height: 36px;
  width: 100%;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  border-radius: ${props => props.theme.borderRadius.s};
`;

const Image = styled.img`
  width: 21px;
  height: 21px;
  object-fit: contain;
  border-radius: 4px;
  margin-right: 5px;
`;

const Details = styled.div`
  ${flexColumn()}
  justify-content: flex-start;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    display: none;
  }
`;

const Name = styled.span`
  ${flexRow()}
  justify-content: flex-start;
  align-items: center;
  font-weight: bold;
  color: ${props => props.theme.text.primary};
  font-size: ${props => props.theme.font.sizes.xs};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  > span:empty + span {
    margin-left: 0;
  }
`;

const Wallet = styled.span<{ hasName: boolean }>`
  color: ${props => props.theme.text.primary};
  font-size: ${props => props.theme.font.sizes[props.hasName ? 'xs' : 'm']};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${props => (props.hasName ? 'line-height: 1;' : '')}
`;

export const AccountButton: React.FC<AccountButtonProps> = ({
  wallet,
  image = defaultImage,
  name,
  onClick,
  className,
}) => {
  const cls = `account-button ${className || ''}`;
  return (
    <Container onClick={onClick} className={cls}>
      {image && <Image src={image} />}
      <Details>
        {name && <Name>{name}</Name>}
        <Wallet hasName={!!name}>{wallet}</Wallet>
      </Details>
    </Container>
  );
};
