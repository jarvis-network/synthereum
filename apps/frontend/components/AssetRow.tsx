import React, { FC, ReactNode } from 'react';
import { styled, Flag, themeValue, Skeleton } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

import { Asset, PRIMARY_STABLE_COIN_TEXT_SYMBOL } from '@/data/assets';
import { DEXValue } from './DEXValue';

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

const titleMarginLeft = '24px';
const Title = styled.div`
  color: ${props => props.theme.text.primary};
  margin-left: ${titleMarginLeft};
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

const wrapper = (children: ReactNode) =>
  children === '-.--' ? (
    <Value>Loading…</Value>
  ) : (
    <Value>
      {PRIMARY_STABLE_COIN_TEXT_SYMBOL}
      {children}
    </Value>
  );
export const AssetRow: FC<AssetRowProps> = ({
  asset,
  amount,
  value,
  onAddToMetaMaskClick,
}) => {
  const valueElem =
    !asset.synthetic && !asset.collateral ? (
      <DEXValue asset={asset} amount={amount} wrapper={wrapper} />
    ) : (
      value && (
        <Value>
          {PRIMARY_STABLE_COIN_TEXT_SYMBOL}
          {value.format(2)}
        </Value>
      )
    );

  const addToMetaMask = onAddToMetaMaskClick && !asset.native && (
    <MetamaskButton onClick={onAddToMetaMaskClick}>
      Add to <MetamaskLogo src="/images/metamask.svg" alt="MetaMask logo" />
    </MetamaskButton>
  );

  return (
    <Container>
      <Information>
        <Flag flag={asset.icon} />
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

export function AssetRowSkeleton(): JSX.Element {
  return (
    <Container>
      <Information>
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton
          variant="text"
          width={35}
          sx={{ marginLeft: titleMarginLeft }}
        />
      </Information>
      <Details>
        <Amount>
          <Skeleton variant="text" width={31.55} />
        </Amount>
        <Value>
          <Skeleton variant="text" width={48.59} />
        </Value>
      </Details>
    </Container>
  );
}
