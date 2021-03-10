import React, { FC } from 'react';
import { styled, Flag, themeValue } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { Asset, PRIMARY_STABLE_COIN_TEXT_SYMBOL } from '@/data/assets';

export interface AssetRowProps {
  asset: Asset;
  amount: FPN;
  value: FPN | null;
  onAddToMetaMaskClick?: () => void;
}

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 24px;
  margin: 0 -24px;

  :not(:last-child) {
    border-bottom: 1px solid ${props => props.theme.border.secondary};
  }
`;

const Information = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const Title = styled.div`
  color: ${props => props.theme.text.primary};
  margin-left: 24px;
`;

const MetamaskButton = styled.button`
  display: flex;
  justify-content: flex-start;
  color: ${themeValue(
    {
      light: theme => theme.text.secondary,
    },
    theme => theme.text.medium,
  )};
  border: 1px solid ${props => props.theme.border.primary};
  padding: 5px 7px;
  border-radius: ${props => props.theme.borderRadius.s};
  background: transparent;
  outline: none !important;
  cursor: pointer;
  font-size: ${props => props.theme.font.sizes.s};
  font-family: Krub;
  font-weight: 300;
  transform: translateY(-1px);
  transition: border, opacity 0.1s ease-in;
  margin-left: 10px;

  :hover,
  :focus,
  :active {
    border-color: transparent;
  }

  :hover {
    opacity: 0.9;
  }

  :focus {
    opacity: 0.8;
  }

  :active {
    opacity: 0.7;
  }
`;

const MetamaskLogo = styled.img`
  height: ${props => props.theme.font.sizes.m};
  margin-left: 4px;
  transform: translateY(1px);
`;

const Details = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
`;

const Amount = styled.div`
  color: ${props => props.theme.text.primary};
  padding: 3px 0;
`;

const Value = styled(Amount)`
  color: ${props => props.theme.text.secondary};
`;

export const AssetRow: FC<AssetRowProps> = ({
  asset,
  amount,
  value,
  onAddToMetaMaskClick,
}) => {
  const valueElem = value && (
    <Value>
      {PRIMARY_STABLE_COIN_TEXT_SYMBOL} {value.format(2)}
    </Value>
  );

  const addToMetaMask = onAddToMetaMaskClick && (
    <MetamaskButton onClick={onAddToMetaMaskClick}>
      Add to <MetamaskLogo src="/images/metamask.svg" alt="MetaMask logo" />
    </MetamaskButton>
  );

  return (
    <Container>
      <Information>
        {asset.icon && <Flag flag={asset.icon} />}
        <Title>{asset.symbol}</Title>
        {addToMetaMask}
      </Information>
      <Details>
        <Amount>{amount.format(2)}</Amount>
        {valueElem}
      </Details>
    </Container>
  );
};
