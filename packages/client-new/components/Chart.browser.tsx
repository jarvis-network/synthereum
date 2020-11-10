import dynamic from 'next/dynamic';

export const ChartBrowser = dynamic(() => import('@/components/Chart'), {
  ssr: false,
});
