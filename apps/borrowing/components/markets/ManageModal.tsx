import React, { FC, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Modal, styled, Tabs, IconButton } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import { setMarketsManageKey } from '@/state/slices/markets';
import { Borrow } from '@/components/markets/modal/Borrow';
import { Repay } from '@/components/markets/modal/Repay';
import { Redeem } from '@/components/markets/modal/Redeem';
import { Withdraw } from '@/components/markets/modal/Withdraw';
import { Deposit } from '@/components/markets/modal/Deposit';

const CustomModal = styled(Modal)``;

const ModalRoot = styled.div`
  background: ${props => props.theme.scroll.background};
  color: ${props => props.theme.text.primary};
  border-radius: 20px;
  height: 500px;
  width: 600px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  padding: 20px 40px;
  height: 100%;
`;

export const MarketsManageModal: FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const dispatch = useDispatch();

  const { list, manageKey } = useReduxSelector(state => state.markets);

  const handleClose = () => dispatch(setMarketsManageKey(null));

  const marketToManage = list.find(i => i.key === manageKey);

  const content = (
    <CustomSubTabs
      selected={currentTab}
      onChange={setCurrentTab}
      pointer={false}
      tabs={[
        {
          title: 'Borrow',
          content: (
            <Content>
              <Borrow />
            </Content>
          ),
        },
        {
          title: 'Repay',
          content: (
            <Content>
              <Repay />
            </Content>
          ),
        },
        {
          title: 'Redeem',
          content: (
            <Content>
              <Redeem />
            </Content>
          ),
        },
        {
          title: 'Deposit',
          content: (
            <Content>
              <Deposit />
            </Content>
          ),
        },
        {
          title: 'Withdraw',
          content: (
            <Content>
              <Withdraw />
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
        <CustomTabs selected={0} tabs={[{ title: 'Manage', content }]} />
      </ModalRoot>
    </CustomModal>
  );
};
