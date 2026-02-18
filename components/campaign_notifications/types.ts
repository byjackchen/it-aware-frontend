import type {
    Notification,
    NotificationChannel,
    NotificationContentBlock,
    NotificationDetail,
    NotificationDetailStatus,
    NotificationStatus,
} from '@/lib/types/objects';

export type CreateEntryMode = 'guided' | 'excel_direct';

export interface WorkerFilters {
    locationOids: string[];
    workerTypes: string[];
}

export interface NotificationReceiverContentRowDraft {
    receiverStableId: string;
    contentBlocks: NotificationContentBlock[];
    sourceRow: number;
}

export interface NotificationReceiverContentRowError {
    sourceRow: number;
    receiverStableId: string;
    message: string;
}

export interface NotificationReceiverContentParseResult {
    rows: NotificationReceiverContentRowDraft[];
    totalRows: number;
    validRows: number;
    duplicateRowsIgnored: number;
    unmatchedStableIds: string[];
    rowErrors: NotificationReceiverContentRowError[];
    fatalError: string | null;
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
