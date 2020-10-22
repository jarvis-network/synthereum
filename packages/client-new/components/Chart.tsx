import React, { FC, useEffect, useRef, useState } from 'react';
import {
  CandlestickSeriesPartialOptions,
  GridOptions,
  IChartApi,
  ISeriesApi,
  LayoutOptions,
  LineStyle,
  PriceScaleOptions,
  TimeScaleOptions,
} from 'lightweight-charts';
import { ThemeConfig } from '@jarvis-network/ui/dist/Theme/types';
import { useTheme } from '@jarvis-network/ui';

type CandleStickChartProps = {
  width?: number;
  height?: number;
  autoWidth?: boolean;
  autoHeight?: boolean;
  data?: any;
};

const mainContentBackground = {
  night: '#2e3541',
  dark: '#292929',
  light: '#fff',
};

const chartGridConfig: GridOptions = {
  vertLines: {
    color: '#f2f6f9',
    style: LineStyle.Solid,
    visible: false,
  },
  horzLines: {
    color: '#f2f6f9',
    style: LineStyle.Solid,
    visible: true,
  },
};

const chartPriceAxisConfig: Partial<PriceScaleOptions> = {
  borderVisible: false,
};

const chartTimeScaleConfig: Partial<TimeScaleOptions> = {
  borderVisible: false,
};

const candleStickSeriesConfig: CandlestickSeriesPartialOptions = {
  upColor: '#54FB77',
  wickUpColor: '#54FB77',
  downColor: '#ed3833',
  wickDownColor: '#ed3833',
  borderVisible: false,
};

const Chart: FC<CandleStickChartProps> = ({
  width,
  height,
  autoWidth,
  autoHeight,
  data,
}) => {
  const chartRef = useRef(null);
  const [chart, setChart] = useState<IChartApi>(null);
  const theme: ThemeConfig = useTheme();

  const chartLayoutConfig: Partial<LayoutOptions> = {
    backgroundColor: mainContentBackground[theme.name],
    textColor: theme.text.primary,
    fontFamily: theme.font.family,
    fontSize: 8,
  };

  const initializeCandleStickChart = () => {
    const candleStickSeries: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries(
      candleStickSeriesConfig,
    );

    if (data) {
      candleStickSeries.setData(data);
      chart.timeScale().fitContent();
    }
  };

  const resizeHandler = () => {
    if (chartRef.current) {
      const chartWidth = autoWidth
        ? chartRef.current.parentNode.clientWidth
        : width;
      const chartHeight = autoHeight
        ? chartRef.current.parentNode.clientHeight
        : height;

      chart.resize(chartWidth, chartHeight);
      chart.timeScale().fitContent();
    }
  };

  // import createChart function
  const importCreateChartFunction = async () => {
    try {
      return (await import('lightweight-charts/index')).createChart;
    } catch (err) {
      console.log(err);
    }
  };

  // ----- USEEFFECT HOOKS -----

  // 1. create chart
  useEffect(() => {
    if (chartRef && !chart) {
      importCreateChartFunction().then(createChart => {
        setChart(createChart(chartRef.current));
      });
    }

    return () => chart && chart.remove();
  }, []);

  // 2. add candle series
  useEffect(() => {
    if (chart) {
      initializeCandleStickChart();
    }
  }, [chart]);

  // 3. update chart
  useEffect(() => {
    if (chart) {
      let options = {
        width: autoWidth ? chartRef.current.parentNode.clientWidth : width,
        height: autoHeight ? chartRef.current.parentNode.clientHeight : height,
        layout: chartLayoutConfig,
        grid: chartGridConfig,
        priceScale: chartPriceAxisConfig,
        timeScale: chartTimeScaleConfig,
      };

      chart.applyOptions(options);
      chart.timeScale().fitContent();

      if (autoHeight || autoWidth) {
        window.addEventListener('resize', resizeHandler);
      }
    }

    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }, [chart, chartLayoutConfig]);

  return <div ref={chartRef} />;
};

export default Chart;
