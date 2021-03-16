import React from 'react';

import { number, select } from '@storybook/addon-knobs';

import {
  NotificationsProvider,
  NotificationType,
  NotificationsPlacement,
  useNotifications,
} from '..';
import { Button, styled } from '../..';

export default {
  title: 'Notifications',
};

const Box = styled.div`
  border: 1px solid black;
  max-width: 300px;
  padding: 20px;
  margin: 20px;
  position: relative;
  overflow: hidden;
  min-height: 300px;
`;

const Def = () => {
  const show = useNotifications();

  const timeout = number('Display time', 3000);
  const placement = select('Placement', ['global', 'box'], 'global');

  const showSuccess = () => {
    show(
      'Everything went just fine!',
      NotificationType.success,
      placement,
      timeout,
    );
  };

  const showPending = () => {
    show(
      'Something is happening...',
      NotificationType.pending,
      placement,
      timeout,
    );
  };

  const showError = () => {
    show('Something is broken.', NotificationType.error, placement, timeout);
  };

  const showErrorWithCustomIcon = () => {
    show(
      'Something is broken.',
      { type: NotificationType.error, icon: '👀' },
      placement,
      timeout,
    );
  };

  return (
    <>
      <Button type="success" onClick={showSuccess} size="s">
        Show success notification
      </Button>
      <Button onClick={showPending} size="s">
        Show pending notification
      </Button>
      <Button type="danger" onClick={showError} size="s">
        Show error notification
      </Button>
      <Button type="danger" onClick={showErrorWithCustomIcon} size="s">
        Show error notification with custom icon
      </Button>
      <Box>
        <NotificationsPlacement name="box" />
        Notifications can be shown aligned to specified `placement`. If you want
        demo notification to be shown relative to this box instead of the whole
        screen head to Knobs section.
      </Box>
    </>
  );
};

export const Default = () => (
  <NotificationsProvider>
    <Def />
  </NotificationsProvider>
);
