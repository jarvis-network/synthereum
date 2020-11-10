import React from 'react';
import { useDispatch } from 'react-redux';
import { Flag, Icon, styled } from '@jarvis-network/ui';
import { AssetType } from '@/state/initialState';
import { Asset as AssetItemType } from '@/data/assets';
import { setChooseAsset } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';

const Container = styled.div`
  grid-area: asset;
  justify-self: end;
  margin-top: 5px;
  font-size: 14px;

  img {
    width: 22px;
    height: 22px;
    object-fit: contain;
    vertical-align: middle;
  }

  i svg {
    width: 11px;
    height: 11px;
  }

  .assetName {
    display: inline-block;
    vertical-align: middle;
    margin-left: 7px;
  }
`;

const AssetChangeButton = styled.button`
  border: none;
  padding: 0;
  display: inline-block;
  background: none;
  cursor: pointer;
  outline: none !important;
  color: ${props => props.theme.text.primary};
`;

const AssetSelectButton = styled.button`
  background: red;
  border: none;
  padding: 4px 5px;
  font-size: 12px;
  color: ${props => props.theme.text.secondary};
  background: ${props => props.theme.background.disabled};
  outline: none !important;
  margin-right: -5px;
  cursor: pointer;

  i {
    color: ${props => props.theme.text.secondary}!important;

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
  const asset: AssetItemType = useReduxSelector(state =>
    state.assets.list.find(a => a.symbol === assetSymbol),
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
