import {
  useNotifications,
  useIsMobile,
  NotificationTypeWithOptions,
} from '@jarvis-network/ui';

type NotifyFn = (
  text: string,
  type?: NotificationTypeWithOptions,
  time?: number,
) => void;

export const useExchangeNotifications = (): NotifyFn => {
  const isMobile = useIsMobile();
  const notify = useNotifications();

  const place = isMobile ? 'global' : 'exchange';

  return (text, type?, time?) => {
    notify(text, type, place, time);
  };
};
