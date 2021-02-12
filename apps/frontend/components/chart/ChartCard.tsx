import React, { useState } from 'react';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
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
import { getPercentageChange } from '@/utils/getPercentageChange';
import { InfoBox } from '@/components/chart/InfoBox';
import { ChartData, useChartData } from '@/utils/useChartData';
import { formatDate, formatTimestamp } from '@/utils/format';
import { Days } from '@/components/chart/types';

type ChangeType = 'more' | 'less';

type PayloadWrapper = {
  payload: ChartData;
};

type MouseEventData = {
  activePayload?: PayloadWrapper[];
};

const MORE_STROKE_COLOR = '#00ff38';
const MORE_FILL_COLOR = '#4ffb75';
const LESS_STROKE_COLOR = '#eb4b59';
const LESS_FILL_COLOR = '#f55867';

const getWholeRangeChange = (chartData: ChartData[]): ChangeType => {
  if (chartData.length < 2) {
    return 'more';
  }
  const diff = chartData[0].close - chartData[chartData.length - 1].close;
  if (diff > 0) {
    return 'more';
  }
  return 'less';
};

const getValuesDiff = (compare?: ChartData, current?: ChartData) => {
  if (!compare || !current) {
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
  height: 100%;
  padding: 0;
  box-sizing: border-box;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 30px;
  }

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1] + 1}px) {
    height: calc(475px + 119px); // swap panel + infobox
    padding-bottom: calc(
      60px + 119px
    ); // extra height of the fees box + extra height of the info box, so the infobox is "above"
    align-self: center;
    box-sizing: content-box;
  }
`;

export const ChartCard: React.FC = () => {
  const [days, setDays] = useState<Days>(7);
  const [change, setChange] = useState<ChangeType | null>(null);
  const [changeValue, setChangeValue] = useState<number | null>(null);
  const [changeValuePerc, setChangeValuePerc] = useState<number | null>(null);
  const [currentValue, setCurrentValue] = useState<number | null>(null);

  const theme = useTheme();

  const { paySymbol, receiveSymbol } = useExchangeValues();

  const chartData = useChartData(paySymbol, receiveSymbol, days);

  const rate = useRate(receiveSymbol, paySymbol);
  const wholeRangeChange = getWholeRangeChange(chartData);

  const customTooltip = (info: TooltipProps<number, string>) => {
    return <div>{formatTimestamp(info.label)}</div>;
  };

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
      const currentPayload = chartData[0];

      if ('close' in hoveredPayload) {
        setCurrentValue(hoveredPayload.close);
      }

      const { diff, diffPerc } = getValuesDiff(hoveredPayload, currentPayload);
      setChangeValue(diff);
      setChangeValuePerc(diffPerc);

      if (diff! < 0) {
        setChange('less');
        return;
      }
      if (diff! > 0) {
        setChange('more');
        return;
      }
      setChange(null);
    },
    onMouseLeave: () => {
      resetChart();
    },
  };

  const valueSource = currentValue != null ? new FPN(currentValue) : rate?.rate;
  const value = valueSource?.format(5) || '';

  // can't use transparent, because with recharts it goes dark grey as default
  const bgColor = theme.background.primary;
  const currentStrokeColor =
    (change || wholeRangeChange) === 'more'
      ? MORE_STROKE_COLOR
      : LESS_STROKE_COLOR;

  const currentFillColor =
    (change || wholeRangeChange) === 'more' ? MORE_FILL_COLOR : LESS_FILL_COLOR;

  const beginningPayload = chartData[0];
  const currentPayload = chartData[0];

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
        onDaysChange={val => setDays(val)}
        days={days}
      />
      <ResponsiveContainer>
        <AreaChart data={chartData} {...events}>
          <defs>
            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={currentFillColor} stopOpacity={1} />
              <stop offset="80%" stopColor={bgColor} stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <XAxis
            type="number"
            dataKey="time"
            scale="time"
            domain={['dataMin', 'dataMax']}
            axisLine={false}
            interval="preserveStartEnd"
            tickLine={false}
            tick={{
              color: 'black',
              fontSize: 12,
            }}
            hide
          />
          <YAxis
            hide
            type="number"
            domain={['dataMin', 'dataMax']}
            padding={{ top: 0, bottom: 16 }}
          />
          <Area
            dot={false}
            type="monotone"
            dataKey="close"
            stroke={currentStrokeColor}
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
