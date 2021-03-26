import React, { FC } from 'react';
import { useDispatch } from 'react-redux';
import { ModalContent } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import { setMarketsManageKey } from '@/state/slices/markets';

export const MarketsManageModal: FC = () => {
  const dispatch = useDispatch();

  const { list, manageKey } = useReduxSelector(state => state.markets);

  const handleClose = () => dispatch(setMarketsManageKey(null));

  const marketToManage = list.find(i => i.key === manageKey);

  return (
    <ModalContent
      isOpened={!!marketToManage}
      onClose={handleClose}
      title="Manage"
    >
      Manage market {manageKey}
    </ModalContent>
  );
};
