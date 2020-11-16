import React, { FC } from 'react';
import { useDispatch } from 'react-redux';
import { ModalContent } from '@jarvis-network/ui';

import { setRecentActivityModalVisible } from '@/state/slices/app';
import { useReduxSelector } from '@/state/useReduxSelector';

export const RecentActivityModal: FC = () => {
  const dispatch = useDispatch();

  const isVisible = useReduxSelector(
    state => state.app.isRecentActivityModalVisible,
  );

  const transactions = useReduxSelector(
    state => state.transactions.list.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    ),
  );

  const handleClose = () => {
    dispatch(setRecentActivityModalVisible(false));
  };

  console.log('> transactions', transactions);

  return (
    <ModalContent
      isOpened={isVisible}
      onClose={handleClose}
      title="Recent Activity"
    >
      RecentActivityModal
    </ModalContent>
  );
};
