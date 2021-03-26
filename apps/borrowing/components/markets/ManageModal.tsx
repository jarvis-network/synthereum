import React, { FC, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ModalContent, styled } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import { setMarketsManageKey } from '@/state/slices/markets';
import { Placeholder } from '@/components/markets/modal/Placeholder';

const CustomModalContent = styled(ModalContent)`
  .modal-container {
    display: flex;
    overflow: hidden;
    flex-direction: column;
    width: 600px;
    height: 500px;
  }

  .modal-content {
    flex: 1;
    overflow: auto;
  }
`;

export const MarketsManageModal: FC = () => {
  const [skip, setSkip] = useState(false);
  const dispatch = useDispatch();

  const { list, manageKey } = useReduxSelector(state => state.markets);

  const handleClose = () => dispatch(setMarketsManageKey(null));

  const marketToManage = list.find(i => i.key === manageKey);

  const onSkip = () => setSkip(true);

  const content = skip ? (
    `content ${JSON.stringify(marketToManage)}`
  ) : (
    <Placeholder onSkip={onSkip} />
  );

  return (
    <CustomModalContent
      isOpened={!!marketToManage}
      onClose={handleClose}
      title="Manage"
    >
      {content}
    </CustomModalContent>
  );
};
