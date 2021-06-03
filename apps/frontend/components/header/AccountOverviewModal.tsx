import React, { FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  styled,
  ModalContent,
  FlagImagesMap,
  Skeleton,
} from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import {
  ExchangeToken,
  primaryCollateralSymbol,
} from '@jarvis-network/synthereum-ts/dist/config';

import { AssetRow, AssetRowProps } from '@/components/AssetRow';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAccountOverviewModalVisible } from '@/state/slices/app';
import { Asset, PRIMARY_STABLE_COIN_TEXT_SYMBOL } from '@/data/assets';
import {
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';

interface BalanceProps {
  total: FPN;
}

interface AssetsProps {
  items: AssetRowProps[];
  onAddToMetaMaskClick?: (asset: Asset) => void;
}

const Wrapper = styled.div`
  height: 284px;
  margin: 0 -24px -24px;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: calc(100vh - 134px);
  }
`;

const Container = styled.div`
  padding: 0 24px 24px;
`;

const Block = styled.div`
  margin-top: 20px;
`;

const Heading = styled.h4`
  padding: 0;
  margin: 0;
  font-size: ${props => props.theme.font.sizes.l};
`;

const Content = styled.div`
  padding: 5px 0;
  font-size: ${props => props.theme.font.sizes.m};
`;

const Balance: FC<BalanceProps> = ({ total }) => (
  <Block>
    <Heading>Balance</Heading>
    <Content>
      {PRIMARY_STABLE_COIN_TEXT_SYMBOL} {total.format(2)}
    </Content>
  </Block>
);

const Assets: FC<AssetsProps> = ({ items, onAddToMetaMaskClick }) => (
  <Block>
    <Heading>Assets</Heading>
    {items.map(item => {
      const props: AssetRowProps = { ...item };

      if (
        onAddToMetaMaskClick &&
        item.asset.symbol !== primaryCollateralSymbol
      ) {
        props.onAddToMetaMaskClick = () => onAddToMetaMaskClick(item.asset);
      }

      return <AssetRow {...props} key={item.asset.symbol} />;
    })}
  </Block>
);

export const AccountOverviewModal: FC = () => {
  const dispatch = useDispatch();
  const isVisible = useReduxSelector(
    state => state.app.isAccountOverviewModalVisible,
  );
  const wallet = useReduxSelector(state => state.wallet);
  const assets = useReduxSelector(state => state.assets.list);
  const isLoggedInViaMetaMask = useReduxSelector(
    state => state.auth?.wallet === 'MetaMask',
  );
  const { web3$, realmAgent$ } = useCoreObservables();
  const web3 = useBehaviorSubject(web3$);
  const realmAgent = useBehaviorSubject(realmAgent$);

  const handleClose = () => {
    dispatch(setAccountOverviewModalVisible(false));
  };

  const handleAddToMetamaskClick = (asset: Asset) => {
    if (!realmAgent || !web3 || !web3.currentProvider) {
      return;
    }

    if (typeof web3.currentProvider === 'string') {
      return;
    }

    if (!('request' in web3.currentProvider) || !web3.currentProvider.request) {
      return;
    }

    const { symbol, icon, decimals } = asset;

    if (symbol === primaryCollateralSymbol) {
      return;
    }

    const address = realmAgent.activePools[symbol]?.syntheticToken.address;

    if (!address) {
      return;
    }

    const image = icon
      ? `${window.location.href}${FlagImagesMap[icon]}`
      : `${window.location.href}icons/alpha_192.png`;

    web3.currentProvider.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          symbol,
          decimals,
          address,
          image,
        },
      },
    });
  };

  const getMetaMaskHandler = () => {
    if (!isLoggedInViaMetaMask) {
      return;
    }

    return handleAddToMetamaskClick;
  };

  const items: AssetRowProps[] = useMemo(() => {
    const keys = Object.keys(wallet) as ExchangeToken[];

    return keys
      .map(token => {
        const { amount } = wallet[token]!;
        const asset = assets.find(_asset => _asset.symbol === token);

        if (!asset) {
          return null;
        }

        return {
          asset,
          amount,
          value: asset.price ? amount.mul(asset.price) : null,
        };
      })
      .filter(Boolean) as AssetRowProps[];
  }, [wallet, assets]);

  const total = useMemo(
    () => FPN.sum(items.map(_item => _item.value).filter(Boolean) as FPN[]),
    [items],
  );

  const hasWallet = Object.keys(wallet).length > 0;

  const content = hasWallet ? (
    <Container>
      <Balance total={total} />
      <Assets items={items} onAddToMetaMaskClick={getMetaMaskHandler()} />
    </Container>
  ) : null;

  return (
    <ModalContent isOpened={isVisible} onClose={handleClose} title="Account">
      <Wrapper>
        <Skeleton>{content}</Skeleton>
      </Wrapper>
    </ModalContent>
  );
};
