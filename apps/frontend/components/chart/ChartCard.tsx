import React from 'react';
import { ChartBrowser } from '@/components/Chart.browser';
import { useReduxSelector } from '@/state/useReduxSelector';
import { useFeedData } from '@/utils/useFeedData';

export const ChartCard: React.FC = () => {
  const { payAsset, receiveAsset } = useReduxSelector(state => state.exchange);
  const chartData = useFeedData(payAsset!, receiveAsset!); // @TODO handle currently impossible case when some asset is not selected

  return <ChartBrowser autoWidth autoHeight data={chartData} />;
};
