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
import { useTheme, ThemeConfig } from '@jarvis-network/ui';

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

const chartLinesColors = {
  light: '#f2f6f9',
  dark: '#7E7E7E',
  night: '#63758d',
};

const chartGridConfig = (theme: ThemeConfig): GridOptions => {
  return {
    vertLines: {
      color: chartLinesColors[theme.name],
      style: LineStyle.Solid,
      visible: false,
    },
    horzLines: {
      color: chartLinesColors[theme.name],
      style: LineStyle.Solid,
      visible: true,
    },
  };
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
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const theme: ThemeConfig = useTheme();

  const chartLayoutConfig: Partial<LayoutOptions> = {
    backgroundColor: mainContentBackground[theme.name],
    textColor: theme.text.primary,
    fontFamily: theme.font.family,
    fontSize: 8,
  };

  const initializeCandleStickChart = () => {
    if (!chart) return;
    const candleStickSeries: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries(
      candleStickSeriesConfig,
    );

    if (data) {
      candleStickSeries.setData(data);
      chart.timeScale().fitContent();
    }
  };

  const resizeHandler = () => {
    if (chart && chartRef.current) {
      const parent = chartRef.current.parentNode as Element;
      const chartWidth = autoWidth ? parent.clientWidth : width ?? 400;
      const chartHeight = autoHeight ? parent.clientHeight : height ?? 300;

      chart.resize(chartWidth, chartHeight);
      chart.timeScale().fitContent();
    }
  };

  // import createChart function
  const importCreateChartFunction = async () => {
    return (await import('lightweight-charts')).createChart;
  };

  // ----- USEEFFECT HOOKS -----

  // 1. create chart
  useEffect(() => {
    if (chartRef && !chart) {
      importCreateChartFunction()
        .then(createChart => {
          setChart(createChart(chartRef.current!));
        })
        // eslint-disable-next-line no-console
        .catch(e => console.error(e));
    }

    return () => chart?.remove();
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
      const options = {
        width: autoWidth
          ? (chartRef.current!.parentNode! as Element).clientWidth
          : width,
        height: autoHeight
          ? (chartRef.current!.parentNode! as Element).clientHeight
          : height,
        layout: chartLayoutConfig,
        grid: chartGridConfig(theme),
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
