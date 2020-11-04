import dynamic from 'next/dynamic';

const ChartBrowser = dynamic(() => import('@/components/Chart'), {
  ssr: false,
});

export default ChartBrowser;
