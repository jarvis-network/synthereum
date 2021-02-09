import React, { useState } from 'react';
import { useFeedData } from '@/utils/useFeedData';
import {
  AreaChart,
  XAxis,
  Tooltip,
  Area,
  YAxis,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { useTheme, styled } from '@jarvis-network/ui';

import { useExchangeValues } from '@/utils/useExchangeValues';
import { useRate } from '@/utils/useRate';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { mainContentBackground } from '@/data/backgrounds';
import { DataItem, PricePoint } from '@/state/initialState';
import { getPercentageChange } from '@/utils/getPercentageChange';
import { InfoBox } from '@/components/chart/InfoBox';

type ChangeType = 'more' | 'less';

type PayloadWrapper = {
  payload: DataItem;
};

type MouseEventData = {
  activePayload?: PayloadWrapper[];
};

const getWholeRangeChange = (chartData: DataItem[]): ChangeType => {
  const noGapData = chartData.filter(c => 'close' in c) as PricePoint[];
  if (noGapData.length < 2) {
    return 'more';
  }
  const diff = noGapData[noGapData.length - 1].close - noGapData[0].close;
  if (diff > 0) {
    return 'more';
  }
  return 'less';
};

const getValuesDiff = (compare?: DataItem, current?: DataItem) => {
  if (!compare || !current || !('close' in compare) || !('close' in current)) {
    return {
      diff: null,
      diffPerc: null,
    };
  }

  const diff = compare.close - current.close;

  // why * -1 ? We're following Dodo Exchange logic:
  // If current price is 1 and the hovered price is 0.75 then the percentage
  // value is `0.75 + n% = 1` not `1 - n% = 0.75`

  const diffPerc = getPercentageChange(current.close, compare.close) * -1;
  return {
    diff,
    diffPerc,
  };
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
  heigth: 100%;
`;

export const ChartCard: React.FC = () => {
  const [change, setChange] = useState<ChangeType | null>(null);
  const [changeValue, setChangeValue] = useState<number | null>(null);
  const [changeValuePerc, setChangeValuePerc] = useState<number | null>(null);
  const [currentValue, setCurrentValue] = useState<number | null>(null);

  const { payAsset, receiveAsset } = useReduxSelector(state => state.exchange);
  const theme = useTheme();
  const chartData = useFeedData(payAsset!, receiveAsset!); // @TODO handle currently impossible case when some asset is not selected

  const { paySymbol, receiveSymbol } = useExchangeValues();

  const rate = useRate(receiveSymbol, paySymbol);
  const wholeRangeChange = getWholeRangeChange(chartData);

  const tickFormatter = (timeStr: string | 0) => {
    // uninitialized data causes tick formatter to be called with either `0`
    // (number) or `auto` for some weird reasonpayFlag
    if (timeStr === 'auto' || typeof timeStr === 'number') {
      return '';
    }
    return timeStr.substr(5);
  };

  const xticks =
    chartData.length > 0
      ? [
          String(chartData[0].time),
          String(chartData[Math.ceil(chartData.length / 3)].time),
          String(chartData[2 * Math.ceil(chartData.length / 3)].time),
          String(chartData[chartData.length - 1].time),
        ]
      : [];

  const customTooltip = (info: TooltipProps<number, string>) => (
    <div>{typeof info.label === 'string' ? info.label.substr(5) : null}</div>
  );

  const resetChart = () => {
    setChange(null);
    setChangeValue(null);
    setChangeValuePerc(null);
    setCurrentValue(null);
  };

  const events = {
    onMouseMove: (e: MouseEventData) => {
      if (!e.activePayload) {
        resetChart();
        return;
      }

      const { payload: hoveredPayload } = e.activePayload[0];
      const currentPayload = chartData[chartData.length - 1];

      if ('close' in hoveredPayload) {
        setCurrentValue(hoveredPayload.close);
      }

      const { diff, diffPerc } = getValuesDiff(hoveredPayload, currentPayload);
      setChangeValue(diff);
      setChangeValuePerc(diffPerc);

      if (diff! > 0) {
        setChange('less');
        return;
      }
      if (diff! < 0) {
        setChange('more');
        return;
      }
      setChange(null);
    },
    onMouseLeave: () => {
      resetChart();
    },
  };

  const valueSource = currentValue ? new FPN(currentValue) : rate?.rate;
  const value = valueSource?.format(5) || '';

  // can't use transparent, because with recharts it goes dark grey as default
  const bgColor = mainContentBackground[theme.name];
  const currentColor =
    (change || wholeRangeChange) === 'more'
      ? theme.common.success
      : theme.common.danger;

  const beginningPayload = chartData[0];
  const currentPayload = chartData[chartData.length - 1];

  const {
    diff: wholeRangeChangeValue,
    diffPerc: wholeRangeChangePerc,
  } = getValuesDiff(beginningPayload, currentPayload);

  return (
    <Container>
      <InfoBox
        value={value}
        changeValue={changeValue}
        changeValuePerc={changeValuePerc}
        wholeRangeChangeValue={wholeRangeChangeValue}
        wholeRangeChangePerc={wholeRangeChangePerc}
      />
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} {...events}>
          <defs>
            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={currentColor} stopOpacity={0.95} />
              <stop offset="80%" stopColor={bgColor} stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            axisLine={false}
            interval="preserveStartEnd"
            tickLine={false}
            tick={{
              color: 'black',
              fontSize: 12,
            }}
            ticks={xticks}
            dy={-10}
            tickFormatter={tickFormatter}
          />
          <YAxis
            hide
            domain={['dataMin', 'dataMax']}
            padding={{ top: 0, bottom: 16 }}
          />
          <Area
            dot={false}
            type="monotone"
            dataKey="close"
            stroke={currentColor}
            strokeWidth={2}
            fill="url(#colorUv)"
          />
          <Tooltip
            isAnimationActive={false}
            content={customTooltip}
            position={{
              y: 0,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Container>
  );
};
