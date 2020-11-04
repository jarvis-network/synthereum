import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Icon, styled } from '@jarvis-network/ui';

import { State } from '@/state/initialState';
import {
  setBase,
  setPay,
  setPayAsset,
  setReceive,
  setReceiveAsset,
} from '@/state/slices/exchange';

import ExchangeRate from '@/components/exchange/ExchangeRate';

import Asset from './Asset';

interface Props {}

const ExchangeBox = styled.div`
  margin: 15px 30px;
  border: 1px solid ${props => props.theme.border.secondary};
  padding: 5px 10px 5px 15px;
  display: grid;
  grid-template-columns: auto auto;
  grid-template-rows: auto auto;
  grid-template-areas:
    'title max'
    'amount asset';
`;

const Title = styled.div`
  font-size: ${props => props.theme.font.sizes.s};
  grid-area: title;
`;

const Max = styled.button`
  grid-area: max;
  justify-self: end;
  font-size: 8px;
  color: ${props => props.theme.text.secondary};
  border: none;
  padding: 0;
  background: none;
  outline: none !important;
  text-transform: uppercase;
  cursor: pointer;
`;

const Amount = styled.input`
  grid-area: amount;
  border: none;
  padding: none;
  background: none;
  color: ${props => props.theme.text.secondary};
  font-size: 14px;
  width: 50%;
  outline: none !important;
  margin-top: 5px;
  font-family: Krub;
`;

const Footer = styled.div`
  margin: 0 30px;
`;

const IconButton = styled.button`
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  margin-left: 50px;
  outline: none !important;
`;

const SwapButton = styled(Button)`
  font-weight: normal;
  font-family: 'Krub';
  width: 100%;
  text-align: center;
  margin-top: 25px;
`;

const MainForm: React.FC<Props> = () => {
  const dispatch = useDispatch();

  const base = useSelector((state: State) => state.exchange.base);
  const pay = useSelector((state: State) => state.exchange.pay);
  const receive = useSelector((state: State) => state.exchange.receive);
  const rate = useSelector((state: State) => state.exchange.rate);
  const payAsset = useSelector((state: State) => state.exchange.payAsset);
  const receiveAsset = useSelector(
    (state: State) => state.exchange.receiveAsset,
  );

  const payValue = base === 'pay' ? pay : String(Number(receive) / rate);
  const receiveValue =
    base === 'receive' ? receive : String(Number(pay) * rate);

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
    dispatch(setPayAsset(receiveAsset));
    dispatch(setReceiveAsset(payAsset));

    if (base === 'pay') {
      updateBase('receive');
      updateReceive(payValue);
      return;
    }
    updateBase('pay');
    updatePay(receiveValue);
  };

  return (
    <>
      <ExchangeBox>
        <Title>You pay</Title>
        <Max>max: 12.344</Max>
        <Amount
          value={payValue}
          onChange={e => {
            updateBase('pay');
            updatePay(e.target.value);
          }}
        />
        <Asset type="pay" />
      </ExchangeBox>
      <IconButton onClick={flipValues}>
        <Icon icon="IoIosArrowRoundDown" />
      </IconButton>
      <ExchangeBox>
        <Title>You receive</Title>
        <Amount
          value={receiveValue}
          onChange={e => {
            updateBase('receive');
            updateReceive(e.target.value);
          }}
        />
        <Asset type="receive" />
      </ExchangeBox>
      <Footer>
        <ExchangeRate />
        <SwapButton disabled>Swap</SwapButton>
      </Footer>
    </>
  );
};

export default MainForm;
