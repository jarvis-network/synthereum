export enum NotificationType {
  pending,
  success,
  error,
}

export type NotificationTypeWithOptions =
  | NotificationType
  | {
      type: NotificationType;
      icon: string;
    };

export interface Notification {
  text: string;
  type: NotificationTypeWithOptions;
  time?: number;
}

export interface NotificationWithId extends Notification {
  time: number;
  id: string;
}
