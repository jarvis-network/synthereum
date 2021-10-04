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
  time: number;
  id: string;
  text: string;
  type: NotificationTypeWithOptions;
}
