import React from 'react';
import { Flag, styled } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { useExchangeValues } from '@/utils/useExchangeValues';
import { useFeedData } from '@/utils/useFeedData';
import { useReduxSelector } from '@/state/useReduxSelector';

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
  height: 24px;

  > * {
    position: relative;
  }

  > *:first-child {
    z-index: 2;
  }

  > *:last-child {
    left: -4px;
  }
`;

const PaySymbol = styled.span`
  font-weight: bold;
`;

const ReceiveSymbol = styled.span``;

const Rate = styled.div`
  font-size: ${props => props.theme.font.sizes.xl};
  font-weight: 500;
  margin-top: 0.25em;
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
}

const InfoBox: React.FC<Props> = ({
  value,
  changeValue,
  wholeRangeChangeValue,
  changeValuePerc,
  wholeRangeChangePerc,
}) => {
  const {
    paySymbol,
    receiveSymbol,
    assetPay,
    assetReceive,
  } = useExchangeValues();

  const { payAsset, receiveAsset } = useReduxSelector(state => state.exchange);
  const chartData = useFeedData(payAsset!, receiveAsset!); // @TODO handle currently impossible case when some asset is not selected

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
        <PaySymbol>{paySymbol}</PaySymbol>/
        <ReceiveSymbol>{receiveSymbol}</ReceiveSymbol>
      </Symbols>
      <Rate>
        {value} {receiveSymbol}
      </Rate>
      <Change pastHidden={changeValue !== null}>
        {formatNumberAsDiff(changeValue || wholeRangeChangeValue)}{' '}
        {receiveSymbol} (
        {formatNumberAsDiff(changeValuePerc || wholeRangeChangePerc, 2)}%)
        <span> Past {chartData.length - 1} days</span>
      </Change>
    </Box>
  );
};

export { InfoBox };
