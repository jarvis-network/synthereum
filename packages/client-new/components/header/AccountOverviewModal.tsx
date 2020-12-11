import React, { FC, useContext, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { styled, ModalContent } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { AssetRow, AssetRowProps } from '@/components/AssetRow';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAccountOverviewModalVisible } from '@/state/slices/app';
import { setWalletBalance } from '@/state/slices/wallet';

import { getAllBalances } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';

import { RealmAgentContext } from '../auth/AuthProvider';

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
    return Object.keys(wallet).map(token => {
      const { amount } = wallet[token];
      const asset = assets.find(_asset => _asset.symbol === token)!;

      return {
        asset,
        amount,
        value: amount.mul(asset.price),
      };
    });
  }, [wallet, assets]);

  const total = useMemo(() => {
    return FPN.sum(items.map(_item => _item.value));
  }, [items]);

  const realmAgent = useContext(RealmAgentContext);
  useEffect(() => {
    (async () => {
      if (!realmAgent) return;

      const balances = await getAllBalances(realmAgent);
      const newWallet = balances.map(([asset, amount]) => [
        asset,
        { amount: FPN.fromWei(amount) },
      ]);
      dispatch(setWalletBalance(Object.fromEntries(newWallet)));
      console.log(`Balance updated:`, newWallet);
    })();
  }, [realmAgent]);

  return (
    <ModalContent isOpened={isVisible} onClose={handleClose} title="Account">
      <Wrapper>
        <Balance total={total} />
        <Assets items={items} />
      </Wrapper>
    </ModalContent>
  );
};
