import React, { FC, ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@jarvis-network/ui';
import { motion } from 'framer-motion';

import { Market, setMarketsManageKey } from '@/state/slices/markets';
import { MarketCard } from '@/components/markets/MarketCard';
import { useAuth, useWeb3 } from '@jarvis-network/app-toolkit';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';

const Container = styled.div`
  width: 100%;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Title = styled.div`
  margin-bottom: 30px;
`;

const Items = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 280px 280px 280px;
  column-gap: 40px;
  row-gap: 40px;
`;

interface MarketsRowProps {
  title: ReactNode;
  markets: Market[];
}

const MarketsRow: FC<MarketsRowProps> = ({ title, markets }) => {
  const dispatch = useDispatch();
  const { chainId: networkId } = useWeb3();
  const { login } = useAuth();
  if (!markets.length) {
    return null;
  }

  const handleManageClick = (key: SupportedSelfMintingPairExact) => {
    if (networkId! > 0) {
      dispatch(setMarketsManageKey(key));

      dispatch({
        type: 'UPDATE_PAIRS',
        payload: [key, key.split('/')[1]],
      });
      dispatch({ type: 'GET_MARKET_LIST', payload: key });
    } else {
      login('injected');
    }
  };
  return (
    <Container>
      <Title>{title}</Title>
      <motion.div
        animate={{
          opacity: 1,
          x: 0,
          transition: {
            duration: 0.5,
          },
        }}
        initial={{ opacity: 0, x: -100 }}
      >
        <Items>
          {markets.length > 0 &&
            markets.map(i => (
              <MarketCard
                key={i.pair}
                {...i}
                onManageClick={() => handleManageClick(i.pair)}
              />
            ))}
        </Items>
      </motion.div>
    </Container>
  );
};

export default React.memo(MarketsRow);
