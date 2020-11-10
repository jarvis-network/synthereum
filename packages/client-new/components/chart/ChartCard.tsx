import React from 'react';
import { styled } from '@jarvis-network/ui';
import { Card } from '@/components/Card';
import { ChartBrowser } from '@/components/Chart.browser';

import chartData from '@/data/chartFakeData.json';

const StyledCard = styled(Card)`
  flex: 1;
`;

export const ChartCard: React.FC = () => {
  return (
    <StyledCard title="Chart">
      <ChartBrowser autoWidth autoHeight data={chartData} />
    </StyledCard>
  );
};
