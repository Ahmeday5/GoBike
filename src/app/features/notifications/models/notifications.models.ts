import { NotificationSeverity, NotificationType } from '@core/constants/enums';

/** Notifications page URL state (`GET /notifications` filters). */
export type NotificationsPageQuery = {
  unreadOnly: boolean;
  severity: NotificationSeverity | '';
  type: NotificationType | '';
  pageIndex: number;
  pageSize: number;
};

export const NOTIFICATIONS_QUERY_DEFAULTS: NotificationsPageQuery = {
  unreadOnly: false,
  severity: '',
  type: '',
  pageIndex: 1,
  pageSize: 20,
};
