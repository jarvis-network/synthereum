import React, { FC, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { Modal, styled, Tabs, IconButton } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import { setMarketsManageKey } from '@/state/slices/markets';
import { Borrow } from '@/components/markets/modal/borrow/Borrow';
import { Repay } from '@/components/markets/modal/repay/Repay';
import { Redeem } from '@/components/markets/modal/redeem/Redeem';
import { Withdraw } from '@/components/markets/modal/withdraw/Withdraw';
import { Deposit } from '@/components/markets/modal/deposit/Deposit';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';
import { ButtonHandler } from '@jarvis-network/ui/dist/Tabs/Tabs';

const CustomModal = styled(Modal)``;

const ModalRoot = styled.div`
  background: ${props => props.theme.scroll.background};
  color: ${props => props.theme.text.primary};
  border-radius: 20px;
  height: 560px;
  width: 600px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  // overflow: hidden;
  position: relative;
`;

const CloseButton = styled(IconButton)`
  position: absolute;
  top: 20px;
  right: 40px;

  svg {
    fill: #c7c7c7;
  }
`;

const CustomTabs = styled(Tabs)`
  > *:first-child {
    background: none;
  }

  div[role='button'] {
    margin-left: 40px;

    span {
      font-size: 22px;
      position: relative;
      top: 5px;
      font-weight: normal;
    }
  }
`;

const CustomSubTabs = styled(CustomTabs)`
  div[role='button'] {
    span {
      font-size: 20px;
    }
  }
`;

const Content = styled.div`
  padding: 0 40px 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

export const MarketsManageModal: FC = () => {
  const currentTab = 0;
  const dispatch = useDispatch();
  const tabRef = useRef<ButtonHandler>(null);

  const { list, manageKey: manageKey_ } = useReduxSelector(
    state => state.markets,
  );

  const manageKey = manageKey_ as SupportedSelfMintingPairExact;

  const handleClose = () => {
    dispatch(setMarketsManageKey(null));

    dispatch({
      type: 'UPDATE_PAIRS',
      payload: [...Object.keys(list), 'UMA', 'USDC'],
    });
    dispatch({ type: 'GET_MARKET_LIST' });
    dispatch({
      type: 'transaction/reset',
    });
    dispatch({
      type: 'approvalTransaction/reset',
    });
  };
  const tabHandler = (input: number) => {
    tabRef.current!.updateTab(input);
  };
  const marketToManage = Object.values(list).find(i => i.pair === manageKey);
  const content = (
    <CustomSubTabs
      ref={tabRef}
      selected={currentTab}
      onChange={(_: number) => {
        dispatch({
          type: 'transaction/reset',
        });
        dispatch({
          type: 'approvalTransaction/reset',
        });
      }}
      pointer={false}
      tabs={[
        {
          title: 'Borrow',
          content: (
            <Content>
              <Borrow assetKey={manageKey} tabHandler={tabHandler} />
            </Content>
          ),
        },
        {
          title: 'Repay',
          content: (
            <Content>
              <Repay assetKey={manageKey} tabHandler={tabHandler} />
            </Content>
          ),
        },
        {
          title: 'Redeem',
          content: (
            <Content>
              <Redeem assetKey={manageKey} tabHandler={tabHandler} />
            </Content>
          ),
        },
        {
          title: 'Deposit',
          content: (
            <Content>
              <Deposit assetKey={manageKey} tabHandler={tabHandler} />
            </Content>
          ),
        },
        {
          title: 'Withdraw',
          content: (
            <Content>
              <Withdraw assetKey={manageKey} />
            </Content>
          ),
        },
      ]}
    />
  );

  return (
    <CustomModal isOpened={!!marketToManage} onClose={handleClose}>
      <ModalRoot>
        <CloseButton
          onClick={handleClose}
          icon="IoIosClose"
          type="transparent"
          size="xxxl"
          inline
        />

        <CustomTabs
          selected={currentTab}
          tabs={[{ title: 'Manage', content }]}
        />
      </ModalRoot>
    </CustomModal>
  );
};
