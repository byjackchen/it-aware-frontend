import type {
    Notification,
    NotificationChannel,
    NotificationContentBlock,
    NotificationDetail,
    NotificationDetailStatus,
    NotificationStatus,
} from '@/lib/types/objects';

export type ReceiverMode = 'dimensions' | 'spreadsheet';

export interface WorkerFilters {
    organizationOids: string[];
    locationOids: string[];
    workerTypes: string[];
}

export interface NotificationListQueryState {
    status: NotificationStatus | '';
    channel: NotificationChannel | '';
    search: string;
}

export interface NotificationDetailsQueryState {
    status: NotificationDetailStatus | '';
    search: string;
}

export interface EditableNotificationDetail extends NotificationDetail {
    isNew?: boolean;
}

export interface ContentBlockDraft {
    id: string;
    block: NotificationContentBlock;
}

export interface NotificationListFetchState {
    items: Notification[];
    total: number;
    isLoading: boolean;
    error: string | null;
}

export interface NotificationDetailsFetchState {
    items: NotificationDetail[];
    total: number;
    isLoading: boolean;
    error: string | null;
}
