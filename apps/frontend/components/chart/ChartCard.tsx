import React from 'react';
import { styled } from '@jarvis-network/ui';
import { Card } from '@/components/Card';
import { ChartBrowser } from '@/components/Chart.browser';
import { useReduxSelector } from '@/state/useReduxSelector';
import { useFeedData } from '@/utils/useFeedData';

const StyledCard = styled(Card)`
  flex: 1;
`;

export const ChartCard: React.FC = () => {
  const { payAsset, receiveAsset } = useReduxSelector(state => state.exchange);
  const chartData = useFeedData(payAsset, receiveAsset);

  return (
    <StyledCard title="Chart">
      <ChartBrowser autoWidth autoHeight data={chartData} />
    </StyledCard>
  );
};
