import React from 'react';
import { useDispatch } from 'react-redux';
import { Flag, Icon, Skeleton, styled, themeValue } from '@jarvis-network/ui';

import { Asset as AssetItemType } from '@/data/assets';
import { AssetType } from '@/state/initialState';
import { setChooseAsset } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { useAssets } from '@/utils/useAssets';

const Container = styled.div`
  grid-area: asset;
  justify-self: end;
  font-size: ${props => props.theme.font.sizes.m};
  width: 100px;
  display: flex;

  img {
    width: 22px;
    height: 22px;
    margin-right: 4px;
    object-fit: contain;
    vertical-align: middle;
  }

  .MuiSkeleton-circular {
    display: inline-block;
    width: 22px;
    height: 22px;
  }

  i svg {
    width: 11px;
    height: 11px;
  }

  .symbol {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  i,
  .symbol {
    vertical-align: middle;
    font-size: ${props => props.theme.font.sizes.l};
    font-family: Krub;
    font-weight: 300;
  }

  .spacer-1 {
    flex-grow: 1;
  }
  .spacer-3 {
    flex-grow: 3;
  }
`;

const AssetChangeButton = styled.button<{ display?: 'flex' | 'inline-block' }>`
  border: none;
  padding: 0;
  display: ${({ display = 'inline-block' }) => display};
  background: none;
  cursor: pointer;
  outline: none !important;
  color: ${props => props.theme.text.primary};
  display: flex;
  width: 100%;
  align-items: center;
`;

const AssetSelectButton = styled.button`
  background: red;
  border: none;
  padding: 0 6px;
  height: 26px;
  font-size: ${props => props.theme.font.sizes.xxs};
  color: ${themeValue(
    {
      light: theme => theme.text.secondary,
    },
    theme => theme.text.primary,
  )};
  background: ${props => props.theme.background.disabled};
  outline: none !important;
  margin-right: -5px;
  cursor: pointer;
  font-family: Krub;
  font-weight: 300;

  i {
    color: ${themeValue(
      {
        light: theme => theme.text.secondary,
      },
      theme => theme.text.primary,
    )}!important;
    vertical-align: middle;

    svg {
      width: 11px;
      height: 11px;
    }
  }
`;

interface Props {
  type: AssetType;
}

export const Asset: React.FC<Props> = ({ type }) => {
  const dispatch = useDispatch();
  const assets = useAssets();

  const asset: AssetItemType | undefined = useReduxSelector(state => {
    const assetSymbol =
      type === 'pay' ? state.exchange.payAsset : state.exchange.receiveAsset;

    return assets.find(a => a.symbol === assetSymbol);
  });

  const handleChooseAsset = () => dispatch(setChooseAsset(type));

  if (asset) {
    const flag = <Flag flag={asset.icon} />;

    return (
      <Container>
        <AssetChangeButton onClick={handleChooseAsset}>
          {flag}
          <div className="spacer-1" />
          <div className="symbol">{asset.symbol}</div>
          <div className="spacer-3" />
          <Icon icon="BsChevronDown" />
        </AssetChangeButton>
      </Container>
    );
  }

  return (
    <Container>
      <AssetSelectButton onClick={handleChooseAsset}>
        Select an asset <Icon icon="BsChevronDown" />
      </AssetSelectButton>
    </Container>
  );
};

export function SkeletonAssetChangeButton(): JSX.Element {
  return (
    <Container>
      <AssetChangeButton display="flex">
        <Skeleton variant="circular" />
        <div className="assetName">
          <Skeleton variant="text" width={65} />
        </div>
      </AssetChangeButton>
    </Container>
  );
}
