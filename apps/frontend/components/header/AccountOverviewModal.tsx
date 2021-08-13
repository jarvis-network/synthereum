import React, { FC, ReactNode, useMemo } from 'react';
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
import { AbstractProvider } from 'web3-core';

import {
  AssetRow,
  AssetRowProps,
  AssetRowSkeleton,
} from '@/components/AssetRow';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setAccountOverviewModalVisible } from '@/state/slices/app';
import { Asset, PRIMARY_STABLE_COIN_TEXT_SYMBOL } from '@/data/assets';
import {
  useBehaviorSubject,
  useCoreObservables,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

interface BalanceProps {
  total: FPN | ReactNode;
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
    {total instanceof FPN ? (
      <Content>
        {PRIMARY_STABLE_COIN_TEXT_SYMBOL} {total.format(2)}
      </Content>
    ) : (
      <Content>{total}</Content>
    )}
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
  const { library: web3 } = useWeb3();
  const isLoggedInViaMetaMask = useMemo(
    () =>
      !web3 || !web3.currentProvider || typeof web3.currentProvider === 'string'
        ? false
        : !!(web3.currentProvider as { isMetaMask?: boolean }).isMetaMask,
    [web3],
  );
  const realmAgent = useBehaviorSubject(useCoreObservables().realmAgent$);

  const handleClose = () => {
    dispatch(setAccountOverviewModalVisible(false));
  };

  const handleAddToMetamaskClick = ({ symbol, icon, decimals }: Asset) => {
    if (symbol === primaryCollateralSymbol) {
      return;
    }

    const { address } = assertNotNull(realmAgent).activePools[
      symbol as 'jEUR'
    ]!.syntheticToken;

    if (!address) {
      return;
    }

    const image =
      icon &&
      `${window.location.href}${
        FlagImagesMap[icon as keyof typeof FlagImagesMap]
      }`;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (web3!.currentProvider! as AbstractProvider).request!({
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
        {content || (
          <Container>
            <Balance total={<Skeleton variant="text" width={50} />} />

            <Block>
              <Heading>Assets</Heading>
              {Array.from({ length: 4 }).map((_, index) => (
                /* eslint-disable-next-line react/no-array-index-key */
                <AssetRowSkeleton key={index} />
              ))}
            </Block>
          </Container>
        )}
      </Wrapper>
    </ModalContent>
  );
};
