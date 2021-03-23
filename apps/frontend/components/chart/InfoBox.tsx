import React, { useMemo } from 'react';
import { Flag, styled, Skeleton, Icon, Select } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { useExchangeValues } from '@/utils/useExchangeValues';
import { Days, State } from '@/state/initialState';
import { TwoIconsButton } from '@/components/TwoIconsButton';
import {
  setBase,
  setPay,
  setPayAsset,
  setReceive,
  setReceiveAsset,
} from '@/state/slices/exchange';
import { useDispatch } from 'react-redux';
import { useReduxSelector } from '@/state/useReduxSelector';
import { SyntheticSymbol } from '@jarvis-network/synthereum-contracts/dist/src/config';
import { createPairs } from '@/utils/createPairs';
import { styledScrollbars } from '@/utils/styleMixins';
import { isAppReadySelector } from '@/state/selectors';

const Box = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
  height: auto;
  min-height: 116.5px;
  padding-bottom: 30px;
  box-sizing: border-box;
`;

const Symbols = styled.div`
  height: 24px;
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
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
  min-height: 32px;
  font-weight: 500;
  display: flex;
`;

const RateValue = styled.div`
  flex: 1;
`;

const Change = styled.div<{ pastHidden: boolean }>`
  font-size: ${props => props.theme.font.sizes.s};
  min-height: 18px;

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

const InfoBoxTwoIcons = styled(TwoIconsButton)`
  width: auto;
  transform: none;
  margin-left: 10px;
  transform: rotate(-90deg);
`;

const CustomSelect = styled(Select)`
  min-width: 100px;
  width: auto;
  margin: 0;
  padding: 0;

  .react-select__control {
    max-height: none;
    transition: background-color 300ms;

    &:not(:hover):not(.react-select__control--menu-is-open) {
      background: transparent;
    }
  }

  .react-select__single-value {
    font-size: 20px;
  }

  .react-select__menu-list {
    ${props =>
      styledScrollbars(props.theme, {
        background: props.theme.background.secondary,
      })}
  }
`; //

const InfoBox: React.FC<Props> = ({
  value,
  changeValue,
  wholeRangeChangeValue,
  changeValuePerc,
  wholeRangeChangePerc,
  onDaysChange,
  days,
}) => {
  const dispatch = useDispatch();
  const {
    paySymbol,
    receiveSymbol,
    assetPay,
    assetReceive,
    base,
    payString,
    receiveString,
  } = useExchangeValues();

  const isApplicationReady = useReduxSelector(isAppReadySelector);

  const payFlag = assetPay?.icon ? <CustomFlag flag={assetPay.icon} /> : null;
  const receiveFlag = assetReceive?.icon ? (
    <CustomFlag flag={assetReceive.icon} />
  ) : null;

  const allAssets = useReduxSelector(state => state.assets.list);
  const pairsList = useMemo(
    () =>
      createPairs(allAssets).map(p => `${p.input.symbol} / ${p.output.symbol}`),
    [allAssets],
  );

  const updateBase = (baseValue: State['exchange']['base']) => {
    dispatch(setBase(baseValue));
  };

  const updatePay = (inputValue: State['exchange']['pay']) => {
    dispatch(setPay(inputValue));
  };

  const updateReceive = (inputValue: State['exchange']['receive']) => {
    dispatch(setReceive(inputValue));
  };

  const flipValues = () => {
    dispatch(setPayAsset(receiveSymbol));
    dispatch(setReceiveAsset(paySymbol));

    if (base === 'pay') {
      updateBase('receive');
      updateReceive(payString);
      return;
    }
    updateBase('pay');
    updatePay(receiveString);
  };

  const handlePairChange = (symbols: string) => {
    const [pay, receive] = symbols.split(' / ') as SyntheticSymbol[];

    dispatch(setPayAsset(pay));
    dispatch(setReceiveAsset(receive));
  };

  const isInfoBoxVisible = () => {
    return isApplicationReady && value;
  }

  const selectedPair = `${paySymbol} / ${receiveSymbol}`;

  const content = isInfoBoxVisible() ? (
    <>
      <Symbols>
        <Flags>
          {payFlag}
          {receiveFlag}
        </Flags>
        <CurrencySymbol>
          <CustomSelect
            selected={selectedPair}
            onChange={val => handlePairChange(String(val!.value))}
            rowsText=""
            options={pairsList}
          />
        </CurrencySymbol>
        <InfoBoxTwoIcons onClick={flipValues}>
          <Icon icon="IoIosArrowRoundUp" />
          <Icon icon="IoIosArrowRoundDown" />
        </InfoBoxTwoIcons>
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
    </>
  ) : null;

  return (
    <Box>
      <Skeleton>{content}</Skeleton>
    </Box>
  );
};

export { InfoBox };
