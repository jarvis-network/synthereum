import React, { FC, useEffect, useRef, useState, useMemo } from 'react';
import { useTheme, ThemeConfig } from '@jarvis-network/ui';
import {
  CandlestickSeriesPartialOptions,
  GridOptions,
  IChartApi,
  ISeriesApi,
  LayoutOptions,
  LineStyle,
  PriceScaleOptions,
  TimeScaleOptions,
  WhitespaceData,
} from 'lightweight-charts';

import { PricePoint } from '@/state/initialState';

export type DataItem = PricePoint | (WhitespaceData & { history?: boolean });

type CandleStickChartProps = {
  width?: number;
  height?: number;
  autoWidth?: boolean;
  autoHeight?: boolean;
  data?: DataItem[];
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

const chartGridConfig = (theme: ThemeConfig): GridOptions => ({
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
});

const Chart: FC<CandleStickChartProps> = ({
  width,
  height,
  autoWidth,
  autoHeight,
  data,
}) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const theme: ThemeConfig = useTheme();

  const historicalData = useMemo(() => (data || []).filter(i => i.history), [
    data,
  ]);
  const dynamicData = useMemo(() => (data || []).filter(i => !i.history), [
    data,
  ]);

  const [chartInstance, setChartInstance] = useState<IChartApi | null>(null);

  const [
    historicalCandlesticks,
    setHistoricalCandlesticks,
  ] = useState<ISeriesApi<'Candlestick'> | null>(null);

  const [
    dynamicCandlesticks,
    setDynamicCandlesticks,
  ] = useState<ISeriesApi<'Candlestick'> | null>(null);

  const chartLayoutConfig: Partial<LayoutOptions> = {
    backgroundColor: mainContentBackground[theme.name],
    textColor: theme.text.primary,
    fontFamily: theme.font.family,
    fontSize: 8,
  };

  // ----- HELPERS -----

  const importCreateChartFunction = async () => {
    return (await import('lightweight-charts')).createChart;
  };

  const resizeHandler = () => {
    if (!chartInstance || !chartRef.current) {
      return;
    }

    const parent = chartRef.current.parentNode as Element;
    const chartWidth = autoWidth ? parent.clientWidth : width ?? 400;
    const chartHeight = autoHeight ? parent.clientHeight : height ?? 300;

    chartInstance.resize(chartWidth, chartHeight);
    chartInstance.timeScale().fitContent();
  };

  const createCandleSticksSerie = (
    serieData: DataItem[],
    options?: CandlestickSeriesPartialOptions,
  ): ISeriesApi<'Candlestick'> | null => {
    if (!chartInstance) {
      return null;
    }

    // Clone data, as chart mutates the source data and it will cause a redux update bypass dispatcher
    const clonedData = serieData.map(({ history, ...i }) => ({ ...i }));

    // Create new serie with cloned data
    const serie: ISeriesApi<'Candlestick'> = chartInstance.addCandlestickSeries(
      {
        ...candleStickSeriesConfig,
        ...(options || {}),
      },
    );

    // Set serie and fit chart
    serie.setData(clonedData);
    chartInstance.timeScale().fitContent();

    return serie;
  };

  const initializeDynamicCandleStickSerie = () => {
    if (!chartInstance) {
      return;
    }

    // Remove old candlestick serie
    if (dynamicCandlesticks) {
      chartInstance.removeSeries(dynamicCandlesticks);
      setDynamicCandlesticks(null);
    }

    // Create and set new candlestick serie
    setDynamicCandlesticks(
      createCandleSticksSerie(dynamicData, {
        priceLineVisible: true,
        lastValueVisible: true,
      }),
    );
  };

  const initializeHistoricalCandleStickSerie = () => {
    if (!chartInstance) {
      return;
    }

    // Remove old candlestick serie
    if (historicalCandlesticks) {
      chartInstance.removeSeries(historicalCandlesticks);
      setHistoricalCandlesticks(null);
    }

    // Create and set new candlestick serie
    setHistoricalCandlesticks(
      createCandleSticksSerie(historicalData, {
        priceLineVisible: false,
        lastValueVisible: false,
      }),
    );
  };

  // ----- USEEFFECT HOOKS -----

  // create chart on initial run
  useEffect(() => {
    importCreateChartFunction()
      .then(createChart => setChartInstance(createChart(chartRef.current!)))
      // eslint-disable-next-line no-console
      .catch(console.error);

    if (!chartInstance) {
      return;
    }

    // eslint-disable-next-line consistent-return
    return () => chartInstance && chartInstance.remove();
  }, []);

  // apply new options for chart instance on options change
  useEffect(() => {
    if (!chartInstance || !chartRef.current || !chartInstance) {
      return;
    }

    const parent = chartRef.current.parentNode as Element;
    const chartWidth = autoWidth ? parent.clientWidth : width ?? 400;
    const chartHeight = autoHeight ? parent.clientHeight : height ?? 300;

    const options = {
      width: chartWidth,
      height: chartHeight,
      layout: chartLayoutConfig,
      grid: chartGridConfig(theme),
      rightPriceScale: chartPriceAxisConfig,
      timeScale: chartTimeScaleConfig,
    };

    chartInstance.applyOptions(options);
    chartInstance.timeScale().fitContent();

    if (autoHeight || autoWidth) {
      window.addEventListener('resize', resizeHandler);
    }

    // eslint-disable-next-line consistent-return
    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }, [chartInstance, chartLayoutConfig]);

  // set historical candlesticks series on historical data change
  useEffect(() => {
    if (!chartInstance) {
      return;
    }

    initializeHistoricalCandleStickSerie();
  }, [chartInstance, historicalData]);

  // set dynamic candlesticks series on dynamic data change
  useEffect(() => {
    if (!chartInstance) {
      return;
    }

    initializeDynamicCandleStickSerie();
  }, [chartInstance, dynamicData]);

  return <div ref={chartRef} />;
};

export default Chart;
