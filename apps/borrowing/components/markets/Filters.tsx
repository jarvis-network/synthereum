import { FC } from 'react';
import { useDispatch } from 'react-redux';
import { Button, styled } from '@jarvis-network/ui';
import { AllButtonProps } from '@jarvis-network/ui/dist/Button/types';

import { useReduxSelector } from '@/state/useReduxSelector';
import {
  SelfMintingMarketAssets,
  setMarketsFilterQuery,
} from '@/state/slices/markets';
import { selfMintingMarketAssets } from '@/data/markets';

const KEY_ALL = 'All';

const Container = styled.div`
  margin-right: -15px;
`;

const InactiveButtonContainer = styled.span<{ isActive: boolean }>`
  opacity: ${props => (props.isActive ? 1 : 0.5)};

  > button {
    background: transparent;
  }
`;

const FilterButton: FC<AllButtonProps & { isActive: boolean }> = ({
  isActive,
  ...props
}) => (
  <InactiveButtonContainer isActive={isActive}>
    <Button {...props} type="transparent" size="m" />
  </InactiveButtonContainer>
);

export const MarketsFilter: FC<{
  markets?: Partial<SelfMintingMarketAssets>;
}> = ({ markets }) => {
  const dispatch = useDispatch();

  const { filterQuery } = useReduxSelector(state => state.markets);

  const handleFilterClick = (key: string) =>
    dispatch(setMarketsFilterQuery(key === KEY_ALL ? null : key));

  const keys = [
    KEY_ALL,
    ...new Set([
      ...Object.values(markets!).map(
        i => selfMintingMarketAssets[i.pair].assetIn.name,
      ),
    ]),
  ];

  const activeKey = filterQuery || KEY_ALL;

  return (
    <Container>
      {keys.map(key => (
        <FilterButton
          type="transparent"
          isActive={key === activeKey}
          size="m"
          key={key}
          onClick={() => handleFilterClick(key)}
        >
          {key}
        </FilterButton>
      ))}
    </Container>
  );
};
