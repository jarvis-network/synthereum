import React, { FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { styled, ModalContent } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { AssetRow, AssetRowProps } from '@/components/AssetRow';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAccountOverviewModalVisible } from '@/state/slices/app';

import { SyntheticSymbol } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { PrimaryStableCoin } from '@jarvis-network/synthereum-contracts/dist/src/config/data/stable-coin';

interface BalanceProps {
  total: FPN;
}

interface AssetsProps {
  items: AssetRowProps[];
}

const Wrapper = styled.div``;

const Block = styled.div`
  margin-top: 20px;
`;

const Heading = styled.h4`
  padding: 0;
  margin: 0;
  font-size: ${props => props.theme.font.sizes.l};
`;

const Content = styled.div`
  padding: ${props => props.theme.font.sizes.m} 0;
  font-size: ${props => props.theme.font.sizes.m};
`;

const Balance: FC<BalanceProps> = ({ total }) => (
  <Block>
    <Heading>Balance</Heading>
    <Content>$ {total.format(2)}</Content>
  </Block>
);

const Assets: FC<AssetsProps> = ({ items }) => (
  <Block>
    <Heading>Assets</Heading>
    {items.map(item => (
      <AssetRow {...item} key={item.asset.symbol} />
    ))}
  </Block>
);

export const AccountOverviewModal: FC = () => {
  const dispatch = useDispatch();
  const isVisible = useReduxSelector(
    state => state.app.isAccountOverviewModalVisible,
  );
  const wallet = useReduxSelector(state => state.wallet);
  const assets = useReduxSelector(state => state.assets.list);

  const handleClose = () => {
    dispatch(setAccountOverviewModalVisible(false));
  };

  const items: AssetRowProps[] = useMemo(() => {
    const keys = Object.keys(wallet) as (SyntheticSymbol | PrimaryStableCoin)[];

    return keys.map(token => {
      const { amount } = wallet[token]!;
      const asset = assets.find(_asset => _asset.symbol === token)!;

      return {
        asset,
        amount,
        value: asset.price ? amount.mul(asset.price) : null,
      };
    });
  }, [wallet, assets]);

  const total = useMemo(() => {
    return FPN.sum(items.map(_item => _item.value).filter(Boolean) as FPN[]);
  }, [items]);

  return (
    <ModalContent isOpened={isVisible} onClose={handleClose} title="Account">
      <Wrapper>
        <Balance total={total} />
        <Assets items={items} />
      </Wrapper>
    </ModalContent>
  );
};
