import React, { FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { styled, ModalContent } from '@jarvis-network/ui';
import BN from 'bn.js';

import { AssetRow, AssetRowProps } from '@/components/AssetRow';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAccountOverviewModalVisible } from '@/state/slices/app';
import { formatBN } from '@/utils/format';
import { arraySumBN } from '@/utils/math';
import { PRIMARY_STABLE_COIN } from '@/data/assets';

interface BalanceProps {
  total: Amount;
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
    <Content>$ {formatAmount(total, PRIMARY_STABLE_COIN.decimals)}</Content>
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
    return Object.keys(wallet).map(token => {
      const { amount } = wallet[token];
      const asset = assets.find(_asset => _asset.symbol === token) || null;

      return {
        asset,
        amount,
        value: amount
          .mul(new BN(asset.price * 10 ** asset.decimals))
          .div(new BN(10 ** asset.decimals)),
      };
    });
  }, [wallet, assets]);

  const total = useMemo(() => {
    return arraySumBN(items.map(_item => _item.value));
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
