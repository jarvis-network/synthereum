import React, { FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { styled, ModalContent } from '@jarvis-network/ui';

import { AssetRow, AssetRowProps } from '@/components/AssetRow';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAccountOverviewModalVisible } from '@/state/slices/app';
import { formatFIATPrice } from '@/utils/format';
import { arraySum } from '@/utils/math';

interface BalanceProps {
  total: number;
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
    <Content>{formatFIATPrice(total)}</Content>
  </Block>
);

const Assets: FC<AssetsProps> = ({ items }) => (
  <Block>
    <Heading>Assets</Heading>
    {items.map(item => (
      <AssetRow {...item} key={item.title} />
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
      const { icon, price } =
        assets.find(_asset => _asset.symbol === token) || {};

      return {
        flag: icon,
        title: token,
        amount,
        value: price * amount,
      };
    });
  }, [wallet, assets]);

  const total = useMemo(() => {
    return arraySum(items.map(_item => _item.value));
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
