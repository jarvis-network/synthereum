import React, { useMemo } from 'react';
import {
  Flag,
  styled,
  Skeleton,
  Icon,
  Select,
  Option as OptionWrapper,
  SingleValue,
  styledScrollbars,
  SingleValueProps,
  OptionProps,
} from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

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
import { SupportedSynthereumSymbol } from '@jarvis-network/synthereum-ts/dist/config';
import { createPairs } from '@/utils/createPairs';
import { isAppReadySelector } from '@/state/selectors';

const Box = styled.div<{ hasContent: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
  height: auto;
  min-height: 86.5px;
  margin-bottom: 30px;
  box-sizing: border-box;

  ${props =>
    props.hasContent
      ? ''
      : `
    border-radius: ${props.theme.borderRadius.m};
    overflow: hidden;
  `}
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
  height: 24px;

  > img {
    position: relative;
    height: 24px;
    width: 24px;

    &:first-child {
      z-index: 2;
    }

    &:last-child {
      left: -4px;
    }
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

const CustomSelect = styled(Select as Select<Option>)`
  min-width: 100px;
  width: auto;
  margin: 0 0 0 -4px;
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
        background: props.theme.background.primary,
      })}
  }
`;

const AlignVertically = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 0;
`;

interface Option {
  value: string;
  label: string;
  icon: JSX.Element;
}

function OptionComponent(props: OptionProps<Option, false>) {
  const {
    data: { icon, label },
  } = props;
  return (
    <OptionWrapper {...props}>
      <AlignVertically>
        {icon}
        {label}
      </AlignVertically>
    </OptionWrapper>
  );
}
function SelectValue(props: SingleValueProps<Option>) {
  const {
    data: { icon, label },
  } = props;
  return (
    <SingleValue {...props}>
      <AlignVertically>
        {icon}
        {label}
      </AlignVertically>
    </SingleValue>
  );
}

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
    base,
    payString,
    receiveString,
  } = useExchangeValues();

  const isApplicationReady = useReduxSelector(isAppReadySelector);

  const allAssets = useReduxSelector(state => state.assets.list);
  const options = useMemo(
    () =>
      createPairs(allAssets).map<Option>(p => {
        const label = `${p.input.symbol} / ${p.output.symbol}`;
        return {
          value: label,
          label,
          icon: (
            <Flags>
              {p.input.icon && <Flag flag={p.input.icon} />}
              {p.output.icon && <Flag flag={p.output.icon} />}
            </Flags>
          ),
        };
      }),
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
    const [pay, receive] = symbols.split(' / ') as SupportedSynthereumSymbol[];

    dispatch(setPayAsset(pay));
    dispatch(setReceiveAsset(receive));
  };

  const isInfoBoxVisible = () => isApplicationReady && value;

  const selectedPair = `${paySymbol} / ${receiveSymbol}`;

  const content = isInfoBoxVisible() ? (
    <>
      <Symbols>
        <CurrencySymbol>
          <CustomSelect
            selected={selectedPair}
            onChange={val => handlePairChange(String(val!.value))}
            rowsText=""
            options={options}
            optionComponent={OptionComponent}
            singleValueComponent={SelectValue}
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
    <Box hasContent={!!content}>
      <Skeleton>{content}</Skeleton>
    </Box>
  );
};

export { InfoBox };
