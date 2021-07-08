import React from 'react';
import { useDispatch } from 'react-redux';
import { Flag, Icon, Skeleton, styled, themeValue } from '@jarvis-network/ui';

import { Asset as AssetItemType } from '@/data/assets';
import { AssetType } from '@/state/initialState';
import { setChooseAsset } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';

const Container = styled.div`
  grid-area: asset;
  justify-self: end;
  margin-top: 5px;
  font-size: ${props => props.theme.font.sizes.m};
  width: 100px;

  img {
    width: 22px;
    height: 22px;
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

  .assetName {
    display: inline-flex;
    justify-content: space-between;
    vertical-align: middle;
    width: 65px;
    margin-left: 8px;
    font-size: ${props => props.theme.font.sizes.l};
    font-family: Krub;
    font-weight: 300;
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

  const assetSymbol = useReduxSelector(state =>
    type === 'pay' ? state.exchange.payAsset : state.exchange.receiveAsset,
  );
  const asset: AssetItemType = useReduxSelector(
    state => state.assets.list.find(a => a.symbol === assetSymbol)!,
  );

  const handleChooseAsset = () => dispatch(setChooseAsset(type));

  if (asset) {
    const flag = asset.icon ? <Flag flag={asset.icon} /> : null;

    return (
      <Container>
        <AssetChangeButton onClick={handleChooseAsset}>
          {flag}
          <div className="assetName">
            {asset.symbol} <Icon icon="BsChevronDown" />
          </div>
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
