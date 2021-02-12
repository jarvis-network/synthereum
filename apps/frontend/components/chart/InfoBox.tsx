import React from 'react';
import { Flag, styled } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { useExchangeValues } from '@/utils/useExchangeValues';

import { Days } from './types';

const Box = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
  height: auto;
  padding-bottom: 30px;
  box-sizing: border-box;
`;

const Symbols = styled.div`
  height: 24px;
  display: flex;
  align-items: center;
`;

const Flags = styled.div`
  z-index: 1;
  margin-right: 5px;
  display: block;
  height: 29px;

  > * {
    position: relative;
    height: 29px;
    width: 29px;
  }

  > *:first-child {
    z-index: 2;
  }

  > *:last-child {
    left: -4px;
  }
`;

const CurrencySymbol = styled.span`
  font-size: 20px;
`;

const Rate = styled.div`
  font-size: ${props => props.theme.font.sizes.xl};
  font-weight: 500;
  margin-top: 0.5em;
  display: flex;
`;

const RateValue = styled.div`
  flex: 1;
`;

const Change = styled.div<{ pastHidden: boolean }>`
  font-size: ${props => props.theme.font.sizes.s};

  span {
    visibility: ${props => (props.pastHidden ? 'hidden' : 'visible')};
  }
`;

const CustomFlag = styled(Flag)`
  height: 24px;
  width: 24px;
`;

const DayButton = styled.button<{ active: boolean }>`
  border: none;
  background: none;
  cursor: pointer;
  outline: none !important;
  padding: 0.25em 1em;
  color: ${props => props.theme.text.primary};
  ${props => props.active && 'font-weight: bold;'}
`;

const formatNumberAsDiff = (value: number | null, precision = 5) => {
  if (value == null) {
    return '';
  }

  const sign = value > 0 ? '+' : '';
  return sign + new FPN(value).format(precision);
};

interface Props {
  value: string;
  changeValue: number | null;
  wholeRangeChangeValue: number | null;
  wholeRangeChangePerc: number | null;
  changeValuePerc: number | null;
  onDaysChange: (days: Days) => void;
  days: Days;
}

const daysToLabelMap: Record<Days, string> = {
  1: '24 hours',
  7: 'week',
  30: 'month',
};

const InfoBox: React.FC<Props> = ({
  value,
  changeValue,
  wholeRangeChangeValue,
  changeValuePerc,
  wholeRangeChangePerc,
  onDaysChange,
  days,
}) => {
  const {
    paySymbol,
    receiveSymbol,
    assetPay,
    assetReceive,
  } = useExchangeValues();

  const payFlag = assetPay?.icon ? <CustomFlag flag={assetPay.icon} /> : null;
  const receiveFlag = assetReceive?.icon ? (
    <CustomFlag flag={assetReceive.icon} />
  ) : null;

  return (
    <Box>
      <Symbols>
        <Flags>
          {payFlag}
          {receiveFlag}
        </Flags>
        <CurrencySymbol>
          {paySymbol} {receiveSymbol}
        </CurrencySymbol>
      </Symbols>
      <Rate>
        <RateValue>
          {value} {receiveSymbol}
        </RateValue>
        <div>
          <DayButton active={days === 1} onClick={() => onDaysChange(1)}>
            24H
          </DayButton>
          <DayButton active={days === 7} onClick={() => onDaysChange(7)}>
            W
          </DayButton>
          <DayButton active={days === 30} onClick={() => onDaysChange(30)}>
            M
          </DayButton>
        </div>
      </Rate>
      <Change pastHidden={changeValue !== null}>
        {formatNumberAsDiff(changeValue ?? wholeRangeChangeValue)}{' '}
        {receiveSymbol} (
        {formatNumberAsDiff(changeValuePerc ?? wholeRangeChangePerc, 2)}%)
        <span> Past {daysToLabelMap[days]}</span>
      </Change>
    </Box>
  );
};

export { InfoBox };
